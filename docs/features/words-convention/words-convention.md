# Words Convention — 기능 요약서

## 개요

**Words Convention**은 QA 팀의 용어 표준화 기능이다.

IT 회사에서 같은 UI 요소를 직군마다 다른 이름으로 부르는 문제는 QA 업무의 정확성을 직접적으로 위협한다. 디자이너는 "LNB", 개발자는 "GNB", QA는 "Left Bar"라고 부르면 — 버그 리포트에 적힌 용어가 개발자에게 다른 의미로 전달되고, 테스트 케이스의 Steps가 팀원마다 다르게 해석된다.

Words Convention은 팀 내 공식 용어를 등록하고 관리하여, **버그 리포트, 테스트 케이스, 기능 문서 전반에서 일관된 용어를 사용**할 수 있도록 돕는다.

---

## QA 시니어가 이 기능을 중요하게 봐야 하는 이유

### 1. 버그 리포트의 재현율을 높인다

> "좌측 메뉴에서 클릭하면 에러 발생" — 좌측 메뉴가 LNB인지, Sidebar인지, Drawer인지에 따라 재현 경로가 완전히 달라진다.

용어가 통일되면 **버그 리포트의 모호성이 제거**된다. "LNB > 2번째 항목 클릭 시 에러"라고 작성하면, 개발자가 정확히 같은 위치를 바라본다. QA가 작성한 리포트의 재현율이 올라가고, 핑퐁 커뮤니케이션이 줄어든다.

### 2. 테스트 케이스의 일관성을 보장한다

테스트 케이스의 Steps에서 같은 UI 요소를 다른 이름으로 부르면:
- 다른 QA가 케이스를 실행할 때 **해석 오류** 발생
- 회귀 테스트 시 **동일 기능인지 판별이 어려움**
- 자동화 스크립트의 **셀렉터 네이밍**과 불일치

Words Convention에 등록된 용어를 기준으로 테스트 케이스를 작성하면, 팀 전체가 동일한 언어로 테스트한다.

### 3. 온보딩 시간을 단축한다

신규 QA 팀원이 가장 먼저 부딪히는 벽은 **"팀에서 이걸 뭐라고 부르는지 모르겠다"**이다. Words Convention은 용어 사전 역할을 하며, 대표 이미지가 함께 제공되어 시각적으로 즉시 이해할 수 있다.

### 4. AI 시니어(My Senior)와의 관계

> **이력**: Convention 데이터는 초기에 RAG 파이프라인에 포함되어 있었으나, [my-senior_v5](../senior/my-senior_v5.md)에서 **의도적으로 제거**되었다. 이유: 전체 조회 방식으로 주입되는 Convention 데이터가 KB 검색 결과 대비 노이즈로 작용하여, KB/FAQ의 답변 비중이 낮아지는 문제가 있었다.

현재 Words Convention은 My Senior와 **독립적으로 운영**된다. QA가 용어를 확인하고 싶을 때는 `/conventions`에서 직접 검색하며, AI 챗봇에 용어를 물어보는 것이 아니라 용어 사전에서 직접 찾는 구조이다. 이는 **즉시성과 정확성** 면에서 더 효과적이다 — AI가 생성한 답변보다 팀이 직접 등록한 정의가 더 신뢰할 수 있다.

---

## 현재 구현 상태

### Backend — CRUD + 이미지 업로드 완료

| 파일 | 설명 | 상태 |
|------|------|------|
| `ConventionEntity.java` | JPA 엔티티 (id, term, definition, category, imageUrl, createdAt, updatedAt) | 완료 |
| `ConventionDto.java` | Request/Response record (imageUrl, updatedAt 포함) | 완료 |
| `ConventionRepository.java` | JpaRepository (기본 CRUD) | 완료 |
| `ConventionService.java` | 인터페이스 | 완료 |
| `ConventionServiceImpl.java` | CRUD 구현 (imageUrl, updatedAt 처리) | 완료 |
| `ConventionController.java` | REST 5개 endpoint | 완료 |
| `ConventionImageController.java` | 이미지 업로드/서빙 (POST/GET /api/convention-images) | 완료 |
| `ConventionServiceImplTest.java` | Service 단위 테스트 (45개) | 완료 |
| `ConventionControllerTest.java` | Controller 단위 테스트 (18개) | 완료 |
| `ConventionImageControllerTest.java` | 이미지 Controller 단위 테스트 (4개) | 완료 |

### Frontend — 전면 구현 완료

| 파일 | 설명 | 상태 |
|------|------|------|
| `ConventionsPage.tsx` | Word Card List (검색, 정렬, 그리드) | 완료 |
| `ConventionFormPage.tsx` | 등록/수정 상세 페이지 | 완료 |
| `ConventionCard.tsx` | Word Card 컴포넌트 (이미지 + term + definition + 삭제) | 완료 |
| `ConventionImageUpload.tsx` | 이미지 업로드 (드래그 & 드롭 + 미리보기) | 완료 |
| `types/convention.ts` | Convention 전용 타입 | 완료 |
| `api/convention.ts` | Convention CRUD + 이미지 API 클라이언트 | 완료 |
| `hooks/useConvention.ts` | Convention 목록/검색/정렬/CRUD 훅 | 완료 |

### E2E 테스트

| 파일 | 설명 | 상태 |
|------|------|------|
| `qa/api/convention.spec.ts` | API 테스트 11개 (CRUD + 검증 + 이미지) | 완료 |
| `qa/ui/convention.spec.ts` | UI 테스트 8개 (목록, CRUD, 검색, 정렬) | 완료 |

### RAG 연동

| 항목 | 상태 | 비고 |
|------|------|------|
| RAG 파이프라인 | **의도적 미연동** | 초기 연동 후 v5에서 제거 (노이즈 감소 목적) |

### 알려진 이슈

| 이슈 | 상태 | 문서 |
|------|------|------|
| Convention 생성/수정 후 목록 미반영 (타이밍 레이스) | 미수정 | [words-convention_v2.md](words-convention_v2.md) |

---

## 핵심 사용 시나리오

### 시나리오 1: 새 용어 등록

QA가 프로젝트에서 새로운 UI 요소를 발견했을 때:

```
1. /conventions 진입 → [+ Add Word] 클릭
2. Term: "LNB" 입력
3. Definition: "Left Navigation Bar. 화면 좌측 세로 메뉴 영역. 주요 메뉴 항목을 포함한다." 입력
4. Category: "UI" 입력 (선택)
5. Image: LNB 스크린샷 업로드 (선택 — 시각적 이해를 위해 강력 권장)
6. [Save] → 목록에 카드 추가
```

**QA 팁**: Definition에는 단순 번역이 아닌 **"이 요소가 무엇을 하는지"**를 적는 것이 좋다. "Left Navigation Bar"보다 "화면 좌측 세로 메뉴 영역. 주요 메뉴 항목을 포함한다"가 신규 팀원에게 훨씬 유용하다.

### 시나리오 2: 용어 검색

버그 리포트 작성 중 정확한 용어가 기억나지 않을 때:

```
1. /conventions 진입
2. 검색 바에 "메뉴" 또는 "nav" 입력
3. term, definition, category 전체에서 부분 일치 검색
4. 해당 카드의 term과 이미지로 정확한 용어 확인
```

### 시나리오 3: 이미지로 시각적 확인

용어만으로는 어떤 UI 요소인지 확실하지 않을 때:

```
1. Word Card에 표시된 대표 이미지로 즉시 시각 확인
2. 카드 클릭 → 상세 페이지에서 큰 이미지 확인
3. 이미지가 오래되었으면 새 스크린샷으로 교체
```

---

## 화면 구성

### Word Card List (`/conventions`)

```
+---------------------------------------------+
|  Word Conventions              [+ Add Word]  |  <- Header
+---------------------------------------------+
|  [검색 바]              정렬: [이름순 v]      |
+---------------------------------------------+
|  +----------+  +----------+  +----------+    |
|  | [이미지]  |  | [이미지]  |  | [이미지]  |    |
|  | LNB      |  | GNB      |  | CTA      |    |
|  | Left Na..|  | Global...|  | Call To..|    |
|  |      [삭제]|  |      [삭제]|  |      [삭제]|    |
|  +----------+  +----------+  +----------+    |
+---------------------------------------------+
```

- 그리드 레이아웃: 반응형 (lg: 3열, md: 2열, sm: 1열)
- 검색: 클라이언트 사이드 필터링 (term + definition + category 부분 일치)
- 정렬: 이름순 (term A-Z) / 등록순 (createdAt 최신순)
- Word Card 클릭 → `/conventions/:id` (상세/수정 페이지) 이동
- 삭제 버튼 → 확인 다이얼로그 → 삭제

### Word 등록/수정 (`/conventions/new`, `/conventions/:id`)

```
+---------------------------------------------+
|  <- Word Conventions             [Delete]    |  <- 수정 시만 Delete 표시
+---------------------------------------------+
|  Term *        [input]                       |
|  Definition *  [textarea]                    |
|  Category      [input]                       |
|  Image         [업로드 영역 / 미리보기]        |
|                [Save]                        |
+---------------------------------------------+
```

- 등록(`/conventions/new`): Term, Definition 필수. Save 후 목록으로 리다이렉트
- 수정(`/conventions/:id`): 기존 데이터 로드. Save 후 목록으로 리다이렉트
- 이미지: 선택 사항. 드래그 & 드롭 + 클릭 업로드. 최대 10MB (png, jpg, gif, webp)
- Header `[<- Word Conventions]` 클릭 시 목록으로 복귀

---

## 데이터베이스 스키마

### convention 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| term | VARCHAR(200) NOT NULL | 용어 |
| definition | TEXT NOT NULL | 정의 |
| category | VARCHAR(100) | 카테고리 |
| image_url | VARCHAR(500) | 대표 이미지 URL (v1 추가) |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 (v1 추가) |

- embedding 없음 — 소량 데이터이므로 전체 조회 방식
- Flyway: V4 (초기 생성) + V14 (image_url, updated_at 추가)

---

## Backend API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/conventions` | 전체 조회 |
| GET | `/api/conventions/{id}` | 단건 조회 |
| POST | `/api/conventions` | 생성 (term, definition 필수) |
| PUT | `/api/conventions/{id}` | 수정 |
| DELETE | `/api/conventions/{id}` | 삭제 |
| POST | `/api/convention-images` | 이미지 업로드 (max 10MB, png/jpg/gif/webp) |
| GET | `/api/convention-images/{filename}` | 이미지 서빙 |

모든 응답은 `ApiResponse<T>` (success, message, data) 형식.

---

## 파일 구조

### Backend (`backend/src/main/java/com/myqaweb/convention/`)

```
convention/
├── ConventionController.java       # REST 5개 endpoint
├── ConventionImageController.java  # 이미지 업로드/서빙 (S3ImageService 사용)
├── ConventionService.java          # 인터페이스
├── ConventionServiceImpl.java      # CRUD 구현 (@Transactional)
├── ConventionEntity.java           # JPA 엔티티 (@CreationTimestamp)
├── ConventionRepository.java       # JpaRepository (커스텀 쿼리 없음)
└── ConventionDto.java              # ConventionRequest / ConventionResponse record
```

### Frontend (`frontend/src/`)

```
pages/
├── ConventionsPage.tsx             # Word Card List (검색, 정렬, 그리드)
└── ConventionFormPage.tsx          # 등록/수정 상세 페이지

components/convention/
├── ConventionCard.tsx              # Word Card (이미지 + term + definition + 삭제)
└── ConventionImageUpload.tsx       # 이미지 업로드 (드래그 & 드롭 + 미리보기)

api/
└── convention.ts                   # Convention CRUD + 이미지 API

hooks/
└── useConvention.ts                # 목록/검색/정렬/CRUD 상태 관리

types/
└── convention.ts                   # ConventionItem, ConventionRequest
```

### 테스트

```
backend/src/test/java/com/myqaweb/convention/
├── ConventionServiceImplTest.java      # 45개 — CRUD + imageUrl/updatedAt
├── ConventionControllerTest.java       # 18개 — endpoint + validation
└── ConventionImageControllerTest.java  # 4개 — 업로드/서빙

frontend/src/hooks/__tests__/useConvention.test.ts           # 21개 — 상태, 검색, 정렬
frontend/src/components/convention/__tests__/ConventionCard.test.tsx  # 10개 — 렌더링, 이벤트

qa/api/convention.spec.ts           # API E2E 11개
qa/ui/convention.spec.ts            # UI E2E 8개
```

---

## 용어 등록 가이드 (QA 팀용)

### 어떤 용어를 등록해야 하는가?

| 등록 대상 | 예시 |
|-----------|------|
| **직군 간 다르게 부르는 UI 요소** | LNB, GNB, CTA, Toast, Drawer, Modal |
| **프로젝트 고유 명칭** | "Dashboard" (우리 제품에서의 의미), "Workspace" |
| **약어/축약어** | SSO, MFA, RBAC, SLA |
| **혼동되기 쉬운 유사 개념** | "Dialog" vs "Modal", "Popup" vs "Toast" |
| **테스트 관련 전문 용어** | "Smoke Test", "Regression", "Edge Case" |

### 좋은 Definition 작성법

| 나쁜 예 | 좋은 예 |
|---------|---------|
| "LNB = Left Navigation Bar" | "Left Navigation Bar. 화면 좌측 세로 메뉴 영역. 주요 메뉴 항목(Home, Settings 등)을 포함하며, 접기/펼치기가 가능하다." |
| "Toast = 알림" | "화면 하단에 일시적으로 나타나는 알림 메시지. 3초 후 자동 사라짐. 성공/에러/경고 3종류가 있다." |
| "CTA = Call To Action" | "사용자 행동을 유도하는 주요 버튼. 보통 페이지에서 가장 눈에 띄는 색상(Primary)으로 표시된다. 예: '결제하기', '가입하기'" |

### 이미지 첨부가 특히 중요한 경우

- **UI 요소의 위치**가 중요한 용어 (LNB, GNB, Footer 등)
- **시각적 차이**로 구분되는 용어 (Primary Button vs Secondary Button)
- **상태에 따라 모양이 달라지는** 용어 (Expanded Drawer vs Collapsed Drawer)

---

## 향후 로드맵

### 우선순위 높음

| 항목 | 설명 | 상태 |
|------|------|------|
| v2 버그 수정 | 생성/수정 후 목록 미반영 타이밍 레이스 | 미수정 |

### 향후 고려

| 항목 | QA 가치 |
|------|---------|
| RAG 재연동 (선택적) | 용어 관련 질문 시에만 Convention 컨텍스트 주입 (전체 주입이 아닌 키워드 매칭 방식) |
| 용어 태깅/그룹핑 | 카테고리보다 세밀한 분류 (UI/API/비즈니스 등) |
| 용어 히스토리 | 용어 정의가 변경된 이력 추적 |
| 테스트 케이스 연동 | 테스트 케이스 Steps에서 등록된 용어 자동 하이라이트 |
| 용어 충돌 감지 | 같은 Definition을 가진 다른 Term 등록 시 경고 |

---

## 버전 히스토리

Words Convention 관련 변경 이력을 시간순으로 기록한다. 각 버전 문서는 `docs/features/words-convention/` 디렉토리에 별도 파일로 존재한다.

### 타임라인

| 날짜 | 버전 문서 | 변경 유형 | 요약 |
|------|-----------|-----------|------|
| (v0 이전) | — | 기능 추가 | Backend CRUD + API E2E 테스트 구현 (my-senior v0 시점에 함께 생성) |
| 2026-04-10 | [words-convention_v1.md](words-convention_v1.md) | 기능 추가 | Frontend 전면 구현 (Card List, 등록/수정 페이지, 이미지 첨부), Backend 이미지 업로드 추가, DB에 image_url/updated_at 컬럼 추가 |
| 2026-04-13 | [words-convention_v2.md](words-convention_v2.md) | 버그 수정 | Convention 생성/수정 후 목록 미반영 타이밍 레이스 — 진행 중 |
