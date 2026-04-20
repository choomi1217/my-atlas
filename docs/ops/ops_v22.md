> 변경 유형: 기능 추가  
> 작성일: 2026-04-20  
> 버전: v22  
> 상태: 완료

---

# Ops v22 — AI 사용량 모니터링 + 로그 집계

## 1. 배경

### 현재 상태
- AI 토큰 사용량 추적 **전무** — ChatClient 응답의 `.content()`만 소비, 메타데이터(토큰 수) 폐기
- OpenAI 임베딩 호출 횟수/토큰 미추적
- API 사용 패턴 통계 없음
- 로그는 EC2 로컬 파일에만 존재 (logback 로테이션, 30일 보관)

### 왜 필요한가

| 질문 | 현재 답변 가능? |
|------|:---:|
| 이번 달 Claude API 비용이 얼마인가? | ❌ |
| Senior Chat vs Test Studio 중 어떤 기능이 토큰을 더 쓰나? | ❌ |
| 임베딩 API 호출이 하루에 몇 번 발생하나? | ❌ |
| 어떤 기능을 사용자가 가장 많이 쓰는가? | ❌ |
| PDF 업로드 한 번에 임베딩 비용이 얼마나 드는가? | ❌ |

**목표**: 사용자가 **어떤 기능을 개선할지, 어떤 걸 개발해야 할지** 판단할 수 있는 통계 자료를 제공한다.

---

## 2. 현재 AI 호출 지점 분석

### Claude (Anthropic) — 3곳

| 호출 지점 | 파일 | 방식 | maxTokens |
|-----------|------|------|-----------|
| Senior Chat (SSE) | `SeniorServiceImpl.java` | `.stream().content()` | 2048 (default) |
| TC Draft 생성 | `TestCaseServiceImpl.java` | `.call().content()` | 2048 (default) |
| Test Studio | `TestStudioGenerator.java` | `.call().content()` | 8192 (override) |

**문제:** 3곳 모두 `.content()`로 텍스트만 추출 → `ChatResponse.getMetadata()` (토큰 정보 포함)에 접근하지 않음

### OpenAI Embedding — 3곳

| 호출 지점 | 파일 | 용도 |
|-----------|------|------|
| Senior Chat RAG | `SeniorServiceImpl.java` | 사용자 질문 → 벡터 변환 → KB 검색 |
| PDF 청킹 | `PdfProcessingWorker.java` | 청크별 임베딩 (배치, rate-limited) |
| Test Studio RAG | `TestStudioGenerator.java` | 소스 텍스트 → 벡터 → KB 검색 |

**문제:** `EmbeddingService.embed()`가 토큰 수를 반환하지 않음

---

## 3. 설계

### 3-1. 아키텍처 원칙

| 원칙 | 이유 |
|------|------|
| **PostgreSQL에 저장** | 이미 운영 중인 DB 활용, 추가 인프라 비용 $0 |
| **Prometheus/Grafana 도입 안 함** | t3.small 단일 서버에서 과잉 — 나중에 필요 시 DB → 외부 전환 가능 |
| **비즈니스 지표 우선** | 시스템 메트릭(CPU, 메모리)보다 "어떤 기능에 얼마나 쓰이나"가 중요 |
| **기존 코드 최소 변경** | 인터셉터/래퍼 패턴으로 기존 서비스 로직 침범 최소화 |

### 3-2. 데이터 모델

#### `ai_usage_log` 테이블 (신규)

```sql
CREATE TABLE ai_usage_log (
    id              BIGSERIAL PRIMARY KEY,
    provider        VARCHAR(20)  NOT NULL,   -- 'ANTHROPIC' | 'OPENAI'
    model           VARCHAR(50)  NOT NULL,   -- 'claude-haiku-4-5-20251001' | 'text-embedding-3-small'
    feature         VARCHAR(30)  NOT NULL,   -- 'SENIOR_CHAT' | 'TC_DRAFT' | 'TEST_STUDIO' | 'KB_EMBED' | 'PDF_EMBED'
    input_tokens    INTEGER      NOT NULL DEFAULT 0,
    output_tokens   INTEGER      NOT NULL DEFAULT 0,
    total_tokens    INTEGER      NOT NULL DEFAULT 0,
    estimated_cost  NUMERIC(10,6) NOT NULL DEFAULT 0, -- USD
    duration_ms     INTEGER,                  -- 응답 시간 (ms)
    success         BOOLEAN      NOT NULL DEFAULT true,
    error_message   TEXT,
    user_id         BIGINT,                   -- app_user FK (nullable, 시스템 호출은 null)
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_log_feature ON ai_usage_log(feature);
CREATE INDEX idx_ai_usage_log_created_at ON ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_provider ON ai_usage_log(provider);
```

#### `api_access_log` 테이블 (신규)

```sql
CREATE TABLE api_access_log (
    id              BIGSERIAL PRIMARY KEY,
    method          VARCHAR(10)  NOT NULL,   -- GET, POST, PUT, DELETE
    endpoint        VARCHAR(200) NOT NULL,   -- /api/senior/chat, /api/kb, etc.
    feature         VARCHAR(30)  NOT NULL,   -- 'SENIOR' | 'KB' | 'CONVENTION' | 'FEATURE' | 'TEST_STUDIO'
    status_code     INTEGER      NOT NULL,
    duration_ms     INTEGER      NOT NULL,
    user_id         BIGINT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_access_log_feature ON api_access_log(feature);
CREATE INDEX idx_api_access_log_created_at ON api_access_log(created_at);
```

### 3-3. 비용 계산 기준

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| Anthropic | claude-haiku-4-5 | $1.00 / 1M tokens | $5.00 / 1M tokens |
| OpenAI | text-embedding-3-small | $0.02 / 1M tokens | — |

> 모델 변경 시 application.yml에서 단가도 함께 설정 가능하도록 설계

### 3-4. 토큰 캡처 방식

#### Claude (ChatClient)

**현재:**
```java
// SeniorServiceImpl — 스트리밍
chatClient.prompt().system(systemPrompt).user(message).stream().content()
// → Flux<String> 텍스트만 반환, 토큰 정보 없음

// TestCaseServiceImpl — 동기
chatClient.prompt().user(prompt).call().content()
// → String 텍스트만 반환
```

**변경 후:**
```java
// 스트리밍: .stream().chatResponse()로 변경 → 마지막 chunk에 Usage 포함
chatClient.prompt().system(systemPrompt).user(message)
    .stream().chatResponse()  // Flux<ChatResponse> — 각 chunk에 메타데이터
// → 마지막 ChatResponse.getMetadata().getUsage()에서 토큰 추출

// 동기: .call().chatResponse()로 변경
ChatResponse response = chatClient.prompt().user(prompt).call().chatResponse();
String content = response.getResult().getOutput().getText();
Usage usage = response.getMetadata().getUsage();  // 토큰 정보
```

#### OpenAI Embedding

**현재:**
```java
// EmbeddingService
embeddingModel.embed(text)  // float[] 반환, 토큰 정보 없음
```

**변경 후:**
```java
EmbeddingResponse response = embeddingModel.embedForResponse(List.of(text));
// response.getMetadata() → 토큰 정보 추출 가능
```

### 3-5. 백엔드 구조

```
backend/src/main/java/com/myqaweb/
├── monitoring/
│   ├── AiUsageLogEntity.java          # JPA 엔티티
│   ├── AiUsageLogRepository.java      # JPA 리포지토리
│   ├── ApiAccessLogEntity.java        # JPA 엔티티
│   ├── ApiAccessLogRepository.java    # JPA 리포지토리
│   ├── MonitoringService.java         # 로그 저장 + 통계 쿼리
│   ├── MonitoringController.java      # 통계 API 엔드포인트
│   ├── AiUsageInterceptor.java        # AI 호출 래퍼 (토큰 캡처 + 저장)
│   └── ApiAccessFilter.java           # HTTP 요청 로깅 필터
```

### 3-6. 통계 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/monitoring/ai/summary?period=7d` | AI 사용량 요약 (기간별) |
| GET | `/api/monitoring/ai/by-feature?period=30d` | 기능별 토큰/비용 비교 |
| GET | `/api/monitoring/ai/daily?from=&to=` | 일별 토큰 사용 추이 |
| GET | `/api/monitoring/api/top-endpoints?period=7d` | 가장 많이 호출된 엔드포인트 |
| GET | `/api/monitoring/api/by-feature?period=30d` | 기능별 API 호출 횟수 |

#### 응답 예시: AI 사용량 요약

```json
{
  "period": "2026-04-14 ~ 2026-04-20",
  "totalTokens": 245830,
  "estimatedCost": 0.87,
  "byProvider": {
    "ANTHROPIC": { "inputTokens": 180000, "outputTokens": 42000, "cost": 0.39 },
    "OPENAI":    { "inputTokens": 23830,  "outputTokens": 0,     "cost": 0.0005 }
  },
  "byFeature": {
    "SENIOR_CHAT":  { "calls": 47, "totalTokens": 156000, "cost": 0.31 },
    "TEST_STUDIO":  { "calls": 5,  "totalTokens": 62000,  "cost": 0.07 },
    "TC_DRAFT":     { "calls": 12, "totalTokens": 4000,   "cost": 0.005 },
    "KB_EMBED":     { "calls": 47, "totalTokens": 18000,  "cost": 0.0004 },
    "PDF_EMBED":    { "calls": 0,  "totalTokens": 0,      "cost": 0.0 }
  }
}
```

### 3-7. 프론트엔드 대시보드

새 라우트: `/monitoring`

| 섹션 | 차트 유형 | 데이터 |
|------|-----------|--------|
| AI 비용 요약 카드 | 숫자 카드 3개 | 이번 달 총 비용, Claude 비용, OpenAI 비용 |
| 기능별 토큰 비용 | 가로 바 차트 | Senior Chat vs Test Studio vs TC Draft vs Embedding |
| 일별 토큰 추이 | 라인 차트 | 최근 30일 일별 토큰 사용량 |
| 기능별 API 호출 | 파이 차트 | Senior / KB / Convention / Feature / Test Studio |
| Top 엔드포인트 | 테이블 | 가장 많이 호출된 API 목록 |

**차트 라이브러리**: Recharts (React 생태계, 번들 사이즈 적음, Tailwind 호환)

### 3-8. 로그 집계

#### 현재 문제
- 로그가 EC2 로컬 파일에만 존재 (`backend.log`, `backend-json.log`)
- 30일 보관 후 자동 삭제 — 장기 분석 불가
- EC2 SSH 접속 없이 로그 확인 불가

#### 해결: CloudWatch Logs Agent

| 항목 | 설정 |
|------|------|
| Agent | CloudWatch Unified Agent (EC2에 설치) |
| 수집 대상 | `backend-json.log` (JSON 포맷, 기계 파싱용) |
| Log Group | `/my-atlas/backend` |
| 보관 기간 | 90일 |
| 추가 비용 | ~$0.50/GB 수집 + $0.03/GB 저장 (월 수 MB 예상 → $1 미만) |

#### 왜 CloudWatch인가

| 선택지 | 도입 비용 | 운영 비용 | 적합성 |
|--------|-----------|-----------|--------|
| CloudWatch Logs | EC2 Agent 설치만 | ~$1/월 | **최적** — AWS 내부, 추가 서버 불필요 |
| ELK (Elasticsearch) | 별도 서버 필요 | $30+/월 | 과잉 — 단일 서버에 부적합 |
| Loki + Grafana | 별도 서버 필요 | $20+/월 | 과잉 |
| 파일 유지 (현행) | $0 | $0 | SSH 없이 확인 불가, 30일 한계 |

---

## 4. 구현 계획

### Step 1: DB 스키마 — Flyway 마이그레이션

`ai_usage_log`, `api_access_log` 테이블 생성

### Step 2: 백엔드 — 엔티티 + 리포지토리

JPA 엔티티, 리포지토리, MonitoringService 생성

### Step 3: 백엔드 — AI 토큰 캡처

ChatClient 호출부 3곳 수정:
- `SeniorServiceImpl` — `.stream().content()` → `.stream().chatResponse()` + 토큰 추출
- `TestCaseServiceImpl` — `.call().content()` → `.call().chatResponse()` + 토큰 추출
- `TestStudioGenerator` — 동일 패턴

EmbeddingService 수정:
- `.embed()` → `.embedForResponse()` + 토큰 추출

### Step 4: 백엔드 — API 접근 로깅 필터

`OncePerRequestFilter`로 모든 `/api/**` 요청의 method, endpoint, status, duration 기록

### Step 5: 백엔드 — 통계 API

MonitoringController에 5개 엔드포인트 구현

### Step 6: 프론트엔드 — 모니터링 대시보드

Recharts 설치, `/monitoring` 라우트 + 대시보드 페이지 구현

### Step 7: CloudWatch Logs Agent 설정 (User EC2 직접)

EC2에 CloudWatch Agent 설치 + 설정

### Step 8: Agent-B — Unit/Integration 테스트

MonitoringService, AiUsageInterceptor 테스트

### Step 9: Agent-C — E2E 테스트

모니터링 API + UI 테스트

### Step 10: Agent-D — 빌드 검증

전체 빌드 + E2E 통과 확인

### Step 11: 문서 업데이트

ops.md 버전 히스토리 + ops_v22.md 최종 요약

---

## 5. 변경 파일 예상

| 파일 | 변경 |
|------|------|
| `db/migration/V{timestamp}__create_monitoring_tables.sql` | 신규 — 2개 테이블 |
| `monitoring/AiUsageLogEntity.java` | 신규 |
| `monitoring/ApiAccessLogEntity.java` | 신규 |
| `monitoring/AiUsageLogRepository.java` | 신규 |
| `monitoring/ApiAccessLogRepository.java` | 신규 |
| `monitoring/MonitoringService.java` | 신규 |
| `monitoring/MonitoringController.java` | 신규 |
| `monitoring/ApiAccessFilter.java` | 신규 |
| `common/EmbeddingService.java` | 수정 — 토큰 추출 추가 |
| `senior/SeniorServiceImpl.java` | 수정 — `.stream().chatResponse()` + 토큰 저장 |
| `feature/TestCaseServiceImpl.java` | 수정 — `.call().chatResponse()` + 토큰 저장 |
| `teststudio/TestStudioGenerator.java` | 수정 — 토큰 저장 |
| `auth/SecurityConfig.java` | 수정 — `/api/monitoring/**` permitAll 또는 ADMIN only |
| `frontend/src/pages/MonitoringPage.tsx` | 신규 |
| `frontend/src/api/monitoring.ts` | 신규 |
| `frontend/src/types/monitoring.ts` | 신규 |
| `frontend/package.json` | recharts 의존성 추가 |

---

## 6. 리스크 & 주의사항

| 리스크 | 대응 |
|--------|------|
| 스트리밍(SSE) 토큰 추출 | Spring AI Anthropic의 스트리밍 마지막 chunk에 Usage 포함 여부 확인 필요. 미포함 시 tiktoken으로 수동 계산 |
| ai_usage_log 테이블 증가 | 월 수천 건 수준 (소규모) — 90일 이상 데이터는 집계 테이블로 이관 고려 |
| API 필터 성능 | 비동기 저장 (`@Async`)으로 요청 응답 시간에 영향 없도록 |
| 비용 단가 변경 | application.yml에 단가 설정 → 모델/요금 변경 시 설정만 수정 |
| ADMIN 전용 접근 | 모니터링 데이터는 ADMIN 권한만 접근 가능하도록 SecurityConfig 설정 |

---

## Steps

- [x] Step 1: DB 스키마 — Flyway 마이그레이션
- [x] Step 2: 백엔드 — 엔티티 + 리포지토리 + Service + Controller + Filter
- [x] Step 3: 백엔드 — AI 토큰 캡처 (Claude 3곳 + EmbeddingService 3곳)
- [x] Step 4: 백엔드 — API 접근 로깅 필터 (SSE 제외)
- [x] Step 5: 백엔드 — 통계 API (MonitoringController, ADMIN 전용)
- [x] Step 6: 프론트엔드 — 모니터링 대시보드 (Recharts)
- [x] Step 7: SecurityConfig — `/api/admin/**` ADMIN 전용 규칙
- [x] Step 8: 빌드 검증 + Docker 기동 확인
- [x] Step 9: 문서 업데이트

---

## [최종 요약]

AI 토큰 사용량 모니터링 시스템을 구축했다. `ai_usage_log` 테이블에 Claude/OpenAI 호출마다 feature, provider, model, input/output 토큰, 예상 비용($), 응답 시간을 기록한다. Claude 호출 3곳(`SeniorServiceImpl` SSE 스트리밍, `TestCaseServiceImpl` 동기, `TestStudioGenerator` 비동기)에서 `.content()` → `.chatResponse()`로 전환하여 Usage 메타데이터를 캡처한다. 스트리밍에서 Usage가 null인 경우 문자 수 기반 추정 fallback을 적용한다. OpenAI 임베딩 3곳(`SeniorServiceImpl`, `PdfProcessingWorker`, `TestStudioGenerator`)은 `EmbeddingService`의 오버로드 `embed(text, feature)`로 통합 추적한다.

`api_access_log` 테이블에 모든 `/api/**` 요청의 method, URI, feature, status, duration을 기록한다(`ApiAccessLogFilter`). SSE 엔드포인트(`/api/senior/chat`)는 응답 커밋 충돌 방지를 위해 필터에서 제외한다.

통계 API 4개(`/api/admin/monitoring/ai-summary`, `ai-daily-trend`, `ai-by-feature`, `api-summary`)를 ADMIN 전용으로 제공한다. 프론트엔드 `/monitoring` 라우트에 Recharts 기반 대시보드(비용 요약 카드, 일별 추이 라인 차트, 기능별 비용 바 차트, API 호출 파이 차트, Top 엔드포인트 테이블)를 구현했다. ADMIN 사용자에게만 네비게이션 메뉴가 노출된다.
