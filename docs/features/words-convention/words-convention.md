# Words Convention — 기능 요약서

## 개요

IT 회사에서 직군 간 용어 불일치 문제를 해결하기 위한 팀 용어 표준화 기능.

디자이너는 "LNB", 개발자는 "GNB", QA는 "Left Bar" — 같은 UI 요소를 다른 이름으로 부르며 발생하는 커뮤니케이션 혼선을 방지한다.
팀 내 공식 용어를 등록·관리하여, 문서 작성·버그 리포트·테스트 케이스에서 일관된 용어를 사용할 수 있도록 돕는다.

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
| `ConventionServiceImplTest.java` | Service 단위 테스트 | 완료 |
| `ConventionControllerTest.java` | Controller 단위 테스트 | 완료 |
| `ConventionImageControllerTest.java` | 이미지 Controller 단위 테스트 | 완료 |

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
| `qa/api/convention.spec.ts` | API 테스트 14개 (CRUD + 검증 + 이미지) | 완료 |
| `qa/ui/convention.spec.ts` | UI 테스트 8개 (목록, CRUD, 검색, 정렬) | 완료 |

### RAG 연동

| 항목 | 상태 |
|------|------|
| SeniorServiceImpl에서 convention 컨텍스트 주입 | 명세상 존재하나 코드 미반영 |

---

## 화면 구성

### Word Card List (`/conventions`)

```
┌─────────────────────────────────────────┐
│  Word Conventions            [+ Add Word] │  ← Header
├─────────────────────────────────────────┤
│  🔍 [검색 바]        정렬: [이름순 ▼]     │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ [이미지]  │  │ [이미지]  │  │ [이미지]  │ │
│  │ LNB      │  │ GNB      │  │ CTA      │ │
│  │ Left Na..│  │ Global...│  │ Call To..│ │
│  │      [🗑️]│  │      [🗑️]│  │      [🗑️]│ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────┘
```

### Word 등록/수정 (`/conventions/new`, `/conventions/:id`)

```
┌─────────────────────────────────────────┐
│  ← Word Conventions         [Delete]     │
├─────────────────────────────────────────┤
│  Term *        [input]                   │
│  Definition *  [textarea]                │
│  Category      [input]                   │
│  Image         [업로드 영역 / 미리보기]    │
│                [Save]                    │
└─────────────────────────────────────────┘
```

---

## 데이터베이스 스키마 (V4 + V14)

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

---

## Backend API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/conventions` | 전체 조회 |
| GET | `/api/conventions/{id}` | 단건 조회 |
| POST | `/api/conventions` | 생성 (term, definition 필수) |
| PUT | `/api/conventions/{id}` | 수정 |
| DELETE | `/api/conventions/{id}` | 삭제 |
| POST | `/api/convention-images` | 이미지 업로드 |
| GET | `/api/convention-images/{filename}` | 이미지 서빙 |

---

## 파일 구조

### Backend (`backend/src/main/java/com/myqaweb/convention/`)

```
convention/
├── ConventionController.java       # REST 5개 endpoint
├── ConventionImageController.java  # 이미지 업로드/서빙
├── ConventionService.java          # 인터페이스
├── ConventionServiceImpl.java      # CRUD 구현
├── ConventionEntity.java           # JPA 엔티티
├── ConventionRepository.java       # JpaRepository
└── ConventionDto.java              # ConventionRequest / ConventionResponse record
```

### Frontend (`frontend/src/`)

```
pages/
├── ConventionsPage.tsx             # Word Card List (검색, 정렬, 그리드)
└── ConventionFormPage.tsx          # 등록/수정 상세 페이지

components/convention/
├── ConventionCard.tsx              # Word Card 컴포넌트
└── ConventionImageUpload.tsx       # 이미지 업로드 영역

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
├── ConventionServiceImplTest.java
├── ConventionControllerTest.java
└── ConventionImageControllerTest.java

frontend/src/hooks/__tests__/useConvention.test.ts
frontend/src/components/convention/__tests__/ConventionCard.test.tsx

qa/api/convention.spec.ts           # API E2E 14개
qa/ui/convention.spec.ts            # UI E2E 8개
```

---

## 테스트

### Backend 단위 테스트
- `ConventionServiceImplTest.java` — Service CRUD + imageUrl/updatedAt 테스트
- `ConventionControllerTest.java` — Controller endpoint + imageUrl 테스트
- `ConventionImageControllerTest.java` — 이미지 업로드/서빙 테스트

### Frontend 단위 테스트
- `useConvention.test.ts` — Hook 상태 관리, 검색, 정렬, CRUD
- `ConventionCard.test.tsx` — 카드 렌더링, 클릭, 삭제, 이미지 표시

### E2E 테스트 (Playwright)
- `qa/api/convention.spec.ts` — 14개 (CRUD, 검증, 이미지 업로드)
- `qa/ui/convention.spec.ts` — 8개 (목록, 생성, 수정, 삭제, 검색, 정렬)

---

## 버전 히스토리

Words Convention 관련 변경 이력을 시간순으로 기록한다. 각 버전 문서는 `docs/features/words-convention/` 디렉토리에 별도 파일로 존재한다.

### 타임라인

| 날짜 | 버전 문서 | 변경 유형 | 요약 |
|------|-----------|-----------|------|
| (v0 이전) | — | 기능 추가 | Backend CRUD + API E2E 테스트 구현 (my-senior v0 시점에 함께 생성) |
| 2026-04-10 | [words-convention_v1.md](words-convention_v1.md) | 기능 추가 | Frontend 전면 구현 (Card List, 등록/수정 페이지, 이미지 첨부), Backend 이미지 업로드 추가, DB에 image_url/updated_at 컬럼 추가 |
