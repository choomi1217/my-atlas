> 변경 유형: 기능 개선  
> 작성일: 2026-04-08  
> 버전: v4  
> 상태: 완료

---

# FAQ → KB 기반 큐레이션 뷰 전환

## 1. 요구사항

Senior의 FAQ 목록에 나오는 내용은 KB에 등록된 글이어야만 합니다.

그리고 KB 중에서도 선정된 글만이 FAQ 목록에 나오게 됩니다.

선정 방법은:

1. 유저가 Chat을 통해 검색한 전적이 많음
2. 관리자가 강제로 FAQ에 무조건 나오게 고정

위 두가지 방법입니다.

전적이 많은 글 5건, 고정 15건으로 한 화면 20개의 FAQ를 collapse로 접었다 펼칠 수 있는 목록으로 제공하는것이 목표입니다.

---

## 2. 변경 요약

| 항목 | Before (v3) | After (v4) |
|------|-------------|------------|
| FAQ 데이터 소스 | `faq` 테이블 (독립 CRUD) | `knowledge_base` 테이블 (큐레이션) |
| FAQ 목록 구성 | 전체 FAQ 목록 | 고정 15건 + 검색 빈도 Top 5 = 최대 20건 |
| FAQ CRUD | 생성/수정/삭제 가능 | 제거 (KB에서 관리) |
| KB 관리 | CRUD만 | CRUD + 고정(Pin)/해제 |
| RAG 파이프라인 | KB검색 + FAQ검색 (임베딩 2회) | KB검색만 + 조회수 증가 (임베딩 1회) |
| faq 테이블 | 활성 사용 | 소프트 폐기 (데이터 유지, 코드에서 미사용) |

---

## 3. 핵심 설계

### 3-1. DB 스키마 변경 (Flyway V12)

`knowledge_base` 테이블에 2개 컬럼 추가:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `hit_count` | INTEGER NOT NULL DEFAULT 0 | Chat RAG에서 조회된 횟수 |
| `pinned_at` | TIMESTAMP DEFAULT NULL | 고정 시각 (NULL = 미고정, NOT NULL = 고정) |

```sql
ALTER TABLE knowledge_base ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_base ADD COLUMN pinned_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_kb_pinned_at ON knowledge_base (pinned_at) WHERE pinned_at IS NOT NULL;
CREATE INDEX idx_kb_hit_count ON knowledge_base (hit_count DESC);
```

**설계 결정:**
- `hit_count` (단순 카운터) vs `kb_search_log` (상세 로그 테이블): 카운터 선택. "Top 5" 순위만 필요하므로 단순 카운터로 충분. 로그 테이블은 매 Chat마다 5건 INSERT 부하 발생
- `pinned_at` TIMESTAMP vs `is_pinned` BOOLEAN: TIMESTAMP 선택. NULL/NOT NULL로 고정 여부 판단 + 고정 시간순 정렬 가능
- `faq` 테이블: DROP하지 않음. 기존 데이터 보존, 코드에서만 참조 제거 (소프트 폐기)

### 3-2. 큐레이션 알고리즘

```
getCuratedFaqs():
  1. 고정 목록 조회 (pinned_at IS NOT NULL, ORDER BY pinned_at ASC, 최대 15건)
  2. 고정 ID 집합 생성 (중복 제거용)
  3. 조회수 Top N 조회 (hit_count DESC, 5 + 고정수만큼 여분 조회)
  4. 고정 목록과 겹치는 항목 제외 → 상위 5건 추출
  5. 결합: 고정 목록 + 조회수 목록 = 최대 20건 반환
```

### 3-3. 조회수 증가 시점

Chat RAG 파이프라인에서 KB 벡터 검색 후 조회된 엔트리의 `hit_count`를 +1 증가:
- `appendKnowledgeBase()` 내부에서 `findSimilarManual()` + `findSimilarPdf()` 결과에 대해 실행
- 별도 트랜잭션(`REQUIRES_NEW`)으로 분리하여 메인 Chat 트랜잭션에 영향 없음

### 3-4. RAG 파이프라인 변경

| 순서 | Before | After |
|------|--------|-------|
| 0 | faqContext (사용자 선택) | faqContext (사용자 선택, KB 항목) |
| 1 | Company Features | Company Features |
| 2 | KB Manual Top 3 + PDF Top 2 | KB Manual Top 3 + PDF Top 2 + **hit_count 증가** |
| 3 | **FAQ Top 3** (embeddingService.embed 중복 호출) | **제거** |
| 4 | Conventions | Conventions |

**효과:** 매 Chat 요청당 OpenAI 임베딩 API 호출 2회 → 1회로 절감

---

## 4. API 변경

### Senior API (변경)

| Method | Endpoint | Before | After |
|--------|----------|--------|-------|
| GET | `/api/senior/faq` | FAQ 전체 조회 | **큐레이션된 KB 목록 반환 (최대 20건)** |
| GET | `/api/senior/faq/{id}` | FAQ 단건 조회 | **제거** |
| POST | `/api/senior/faq` | FAQ 생성 | **제거** |
| PUT | `/api/senior/faq/{id}` | FAQ 수정 | **제거** |
| DELETE | `/api/senior/faq/{id}` | FAQ 삭제 | **제거** |
| POST | `/api/senior/chat` | SSE 채팅 | SSE 채팅 + **KB 조회수 증가** |

### KB API (추가)

| Method | Endpoint | 설명 |
|--------|----------|------|
| PATCH | `/api/kb/{id}/pin` | KB 항목 고정 (최대 15건 제한) |
| PATCH | `/api/kb/{id}/unpin` | KB 항목 고정 해제 |

### 응답 DTO 변경

`KbResponse`에 2개 필드 추가:

```java
public record KbResponse(
    Long id, String title, String content, String category,
    String tags, String source,
    int hitCount,              // 추가
    LocalDateTime pinnedAt,    // 추가
    LocalDateTime createdAt, LocalDateTime updatedAt
) {}
```

---

## 5. Frontend 변경

### 5-1. FaqView (핵심 변경)

- **제거**: `+ 추가` 버튼, `FaqFormModal`, CRUD 관련 상태/핸들러
- **유지**: 검색 바 (클라이언트 사이드 필터링), collapse/expand 카드 목록
- **변경**: 데이터 소스를 `useFaq` → `useCuratedFaq` (KB 기반) 로 전환

### 5-2. FaqCard (변경)

- **제거**: `onEdit`, `onDelete` props, Edit/Delete 버튼
- **변경**: `FaqItem` → `KbItem` 타입 수용
- **추가**: `category`, `source` 표시 (선택적)
- **유지**: collapse/expand 동작, "Chat에서 더 물어보기 →" 버튼

### 5-3. KbManagementView (추가 기능)

- KB 카드에 **고정/해제 토글 버튼** (Pin 아이콘) 추가
- 고정 상태 시각 표시 (뱃지 또는 아이콘 색상)
- `hitCount` 표시 (e.g., "42회 조회")
- 15건 제한 초과 시 에러 메시지

### 5-4. 삭제 대상 파일

| 파일 | 사유 |
|------|------|
| `FaqFormModal.tsx` | FAQ CRUD 제거로 미사용 |
| `FaqListView.tsx` | 기존 대체 뷰, 미사용 |

---

## 6. 수정 대상 파일 목록

### Backend

| 파일 | 변경 내용 |
|------|-----------|
| `db/migration/V12__add_kb_hit_count_and_pinned.sql` | **신규** — hit_count, pinned_at 컬럼 + 인덱스 |
| `knowledgebase/KnowledgeBaseEntity.java` | hitCount, pinnedAt 필드 추가 |
| `knowledgebase/KnowledgeBaseRepository.java` | findTopByHitCount, findPinned, incrementHitCount, updatePinnedAt, countPinned 쿼리 추가 |
| `knowledgebase/KnowledgeBaseDto.java` | KbResponse에 hitCount, pinnedAt 추가 |
| `knowledgebase/KnowledgeBaseService.java` | pinKbEntry, unpinKbEntry, getCuratedFaqs 메서드 추가 |
| `knowledgebase/KnowledgeBaseServiceImpl.java` | 위 메서드 구현 (큐레이션 알고리즘, 고정 제한 검증) |
| `knowledgebase/KnowledgeBaseController.java` | PATCH /{id}/pin, PATCH /{id}/unpin 엔드포인트 추가 |
| `senior/SeniorService.java` | findAllFaqs 반환 타입 변경, CRUD 메서드 제거 |
| `senior/SeniorServiceImpl.java` | findAllFaqs → KB 큐레이션 위임, FAQ CRUD 제거, appendFaqContext 제거, appendKnowledgeBase에 hit_count 증가 추가 |
| `senior/SeniorController.java` | FAQ CRUD 엔드포인트 제거 (GET /faq만 유지) |

### Frontend

| 파일 | 변경 내용 |
|------|-----------|
| `types/senior.ts` | KbItem에 hitCount, pinnedAt 추가 |
| `api/senior.ts` | faqApi 단순화 (getAll만), kbApi에 pin/unpin 추가 |
| `hooks/useFaq.ts` → `hooks/useCuratedFaq.ts` | CRUD 제거, 읽기 전용 훅으로 전환 |
| `hooks/useKnowledgeBase.ts` | pinKbItem, unpinKbItem 함수 추가 |
| `hooks/useSeniorChat.ts` | faqContext 타입 FaqItem → KbItem 변경 |
| `components/senior/FaqView.tsx` | CRUD UI 제거, useCuratedFaq 사용 |
| `components/senior/FaqCard.tsx` | KbItem 수용, Edit/Delete 제거 |
| `components/senior/KbManagementView.tsx` | Pin 토글, hitCount 표시 추가 |
| `pages/SeniorPage.tsx` | handleSendToChat 타입 FaqItem → KbItem |
| `components/senior/FaqFormModal.tsx` | **삭제** |
| `components/senior/FaqListView.tsx` | **삭제** |

---

## 7. 구현 순서

### Step 1: DB 마이그레이션 + Entity 변경
- [x] V12 마이그레이션 작성 (hit_count, pinned_at, 인덱스)
- [x] KnowledgeBaseEntity에 hitCount, pinnedAt 필드 추가

### Step 2: Repository + DTO 확장
- [x] KnowledgeBaseRepository에 큐레이션/고정/조회수 쿼리 추가
- [x] KnowledgeBaseDto.KbResponse에 hitCount, pinnedAt 추가
- [x] KnowledgeBaseServiceImpl.toResponse() 매퍼 업데이트

### Step 3: KB 고정(Pin) 기능 구현
- [x] KnowledgeBaseService 인터페이스에 pinKbEntry, unpinKbEntry, getCuratedFaqs 추가
- [x] KnowledgeBaseServiceImpl에 구현 (큐레이션 알고리즘, 15건 제한)
- [x] KnowledgeBaseController에 PATCH /{id}/pin, /{id}/unpin 엔드포인트 추가

### Step 4: RAG 파이프라인 수정 + FAQ 폐기
- [x] SeniorServiceImpl.appendKnowledgeBase()에 hit_count 증가 로직 추가
- [x] SeniorServiceImpl.appendFaqContext() 제거 + buildRagContext()에서 호출 제거
- [x] SeniorServiceImpl.findAllFaqs()를 KnowledgeBaseService.getCuratedFaqs()로 위임
- [x] SeniorService 인터페이스에서 FAQ CRUD 메서드 제거
- [x] SeniorController에서 FAQ CRUD 엔드포인트 제거

### Step 5: Frontend 타입 + API + Hooks
- [x] types/senior.ts — KbItem에 hitCount, pinnedAt 추가
- [x] api/senior.ts — faqApi 단순화, kbApi에 pin/unpin 추가
- [x] hooks/useCuratedFaq.ts 생성 (읽기 전용)
- [x] hooks/useKnowledgeBase.ts에 pin/unpin 추가
- [x] hooks/useSeniorChat.ts — faqContext 타입 변경

### Step 6: Frontend 컴포넌트 변경
- [x] FaqCard.tsx — KbItem 수용, Edit/Delete 제거
- [x] FaqView.tsx — CRUD 제거, useCuratedFaq 사용
- [x] KbManagementView.tsx — Pin 토글 + hitCount 표시 추가
- [x] SeniorPage.tsx — 타입 정합
- [x] FaqFormModal.tsx, FaqListView.tsx 삭제

### Step 7: Backend 테스트
- [x] SeniorServiceImplTest — FAQ CRUD 테스트 제거, 큐레이션 위임 테스트 추가, RAG hit_count 테스트 추가
- [x] SeniorControllerTest — FAQ CRUD 테스트 제거, GET /faq 큐레이션 응답 테스트 추가
- [x] KnowledgeBaseServiceImplTest — pinKbEntry, unpinKbEntry, getCuratedFaqs 테스트 추가

### Step 8: E2E 테스트
- [x] qa/api/senior-faq.spec.ts — FAQ CRUD 테스트를 큐레이션 조회 테스트로 교체
- [x] qa/api/kb-pin.spec.ts — KB 고정/해제 API 테스트 추가
- [x] qa/ui/senior.spec.ts — FAQ 생성/삭제 테스트 제거, KB 기반 FAQ 목록 테스트로 교체

---

## 8. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | My Senior 진입 | FAQ 뷰 기본 노출, KB 기반 큐레이션 목록 표시 (최대 20건) |
| 2 | FAQ 카드 클릭 | 카드 Expand, 내용 + "Chat에서 더 물어보기" 버튼 표시 (Edit/Delete 없음) |
| 3 | "Chat에서 더 물어보기" 클릭 | Chat 전환 + faqContext 배너 + 입력창 포커스 |
| 4 | Chat에서 질문 전송 | RAG 응답 + 조회된 KB의 hit_count 증가 확인 |
| 5 | KB Management에서 항목 고정 | Pin 아이콘 활성화, FAQ 목록에 해당 항목 표시 |
| 6 | KB Management에서 항목 해제 | Pin 해제, FAQ 목록에서 제거 (조회수 Top 5가 아닌 경우) |
| 7 | 16번째 항목 고정 시도 | "최대 15건" 에러 메시지 표시 |
| 8 | 고정 + 조회수 Top 5 중복 | 중복 없이 1건만 표시, 총 20건 이하 |
| 9 | FAQ 검색 바 입력 | 큐레이션 목록 내 클라이언트 사이드 필터링 |
| 10 | `GET /api/senior/faq` 호출 | KbResponse 형식 응답 (hitCount, pinnedAt 포함) |
| 11 | `PATCH /api/kb/{id}/pin` 호출 | 200 OK, pinnedAt 세팅 |
| 12 | `PATCH /api/kb/{id}/unpin` 호출 | 200 OK, pinnedAt null |

---

## [최종 요약]

### 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| `./gradlew clean build` | BUILD SUCCESSFUL |
| `./gradlew test` | 307 tests, 0 failures |
| `npx playwright test` | 156 passed, 4 skipped, 0 failed |
| `docker compose down` | 정상 종료 |

### 변경 파일 요약

**Backend (10 files)**
- V12 마이그레이션 (신규), KnowledgeBaseEntity/Repository/Dto/Service/ServiceImpl/Controller (수정), SeniorService/ServiceImpl/Controller (수정)

**Frontend (9 files, 2 삭제)**
- types/senior.ts, api/senior.ts, hooks: useCuratedFaq.ts(신규)/useSeniorChat.ts/useKnowledgeBase.ts, components: FaqView.tsx/FaqCard.tsx/ChatView.tsx/KbManagementView.tsx/SeniorPage.tsx, FaqFormModal.tsx(삭제)/FaqListView.tsx(삭제)

**Tests (6 files)**
- Backend: SeniorServiceImplTest, SeniorControllerTest, KnowledgeBaseServiceImplTest, KnowledgeBaseControllerTest (수정)
- E2E: senior-faq.spec.ts(수정), kb-pin.spec.ts(신규), senior.spec.ts(수정)
