# Phase 1: 기초 보강 — Backend Unit Test Gap 해소

> 변경 유형: 기능 추가
> 작성일: 2026-03-26
> 버전: v2
> 선행: qa_v1.md (전체 테스트 플랜)
> 상태: 완료

---

## 목표

테스트 커버리지가 **0인 도메인**을 우선 해소한다.
- Convention 도메인: Service + Controller 테스트 전무
- KB Controller: PDF multipart 포함 테스트 전무
- Feature 도메인 Controller: 4개 Controller 테스트 전무
- E2E API: KB, Convention, Senior FAQ spec 전무

**완료 기준:** Backend coverage 60% → 75%+, E2E API 4 → 7 도메인

---

## 작업 목록

### 1. Convention 도메인 테스트 (전체 신규)

**신규 파일:**
- `backend/src/test/java/com/myqaweb/convention/ConventionServiceImplTest.java`
- `backend/src/test/java/com/myqaweb/convention/ConventionControllerTest.java`

**참조 파일:**
- `backend/src/main/java/com/myqaweb/convention/ConventionServiceImpl.java`
- `backend/src/main/java/com/myqaweb/convention/ConventionController.java`
- `backend/src/main/java/com/myqaweb/convention/ConventionDto.java`
- `backend/src/main/java/com/myqaweb/convention/ConventionEntity.java`

**Service Test 시나리오:**

| 메서드 | 테스트 | 설명 |
|--------|--------|------|
| `findAll()` | `findAll_returnsAllConventions` | 2건 저장 후 전체 조회 |
| `findAll()` | `findAll_returnsEmptyList` | 데이터 없을 때 빈 리스트 |
| `findById()` | `findById_returnsWhenExists` | 존재하는 ID 조회 |
| `findById()` | `findById_returnsEmptyWhenNotFound` | 없는 ID → Optional.empty |
| `create()` | `create_savesAndReturnsResponse` | term, definition, category 저장 검증 |
| `update()` | `update_updatesAndReturns` | 기존 데이터 수정 후 반환 |
| `update()` | `update_throwsWhenNotFound` | 없는 ID → IllegalArgumentException |
| `delete()` | `delete_deletesWhenExists` | 존재하는 ID 삭제 성공 |
| `delete()` | `delete_throwsWhenNotFound` | 없는 ID → IllegalArgumentException |

**Controller Test 시나리오:**

| Endpoint | 테스트 | 기대 응답 |
|----------|--------|----------|
| `GET /api/conventions` | `list_returnsOk` | 200 + 리스트 |
| `GET /api/conventions/{id}` | `getById_returnsOk` | 200 + 단건 |
| `GET /api/conventions/{id}` | `getById_returns404WhenNotFound` | 404 |
| `POST /api/conventions` | `create_returns201` | 201 + 생성된 객체 |
| `POST /api/conventions` | `create_returns400WhenTermBlank` | 400 + validation error |
| `PUT /api/conventions/{id}` | `update_returnsOk` | 200 |
| `DELETE /api/conventions/{id}` | `delete_returnsOk` | 200 |

---

### 2. KB Controller 테스트 (신규)

**신규 파일:**
- `backend/src/test/java/com/myqaweb/knowledgebase/KnowledgeBaseControllerTest.java`

**참조 파일:**
- `backend/src/main/java/com/myqaweb/knowledgebase/KnowledgeBaseController.java`
- `backend/src/main/java/com/myqaweb/knowledgebase/KnowledgeBaseDto.java`
- `backend/src/main/java/com/myqaweb/knowledgebase/PdfUploadJobDto.java`

**Controller Test 시나리오:**

| Endpoint | 테스트 | 기대 응답 |
|----------|--------|----------|
| `GET /api/kb` | `list_returnsOkWithItems` | 200 + 리스트 |
| `GET /api/kb/{id}` | `getById_returnsOk` | 200 + 단건 |
| `POST /api/kb` | `create_returns201` | 201 + 생성된 KB |
| `POST /api/kb` | `create_returns400WhenTitleBlank` | 400 |
| `PUT /api/kb/{id}` | `update_returnsOk` | 200 |
| `DELETE /api/kb/{id}` | `delete_returnsOk` | 200 |
| `POST /api/kb/upload-pdf` | `uploadPdf_returns201WithJobId` | 201 + jobId (MockMultipartFile) |
| `POST /api/kb/upload-pdf` | `uploadPdf_returns400WhenFileEmpty` | 400 |
| `GET /api/kb/jobs/{jobId}` | `getJob_returnsJobStatus` | 200 + job status |
| `GET /api/kb/jobs` | `getAllJobs_returnsJobList` | 200 + 리스트 |
| `DELETE /api/kb/books/{source}` | `deleteBook_returnsOk` | 200 |

---

### 3. Feature 도메인 Controller Tests (4개 신규)

**신규 파일:**
- `backend/src/test/java/com/myqaweb/feature/CompanyControllerTest.java`
- `backend/src/test/java/com/myqaweb/feature/ProductControllerTest.java`
- `backend/src/test/java/com/myqaweb/feature/SegmentControllerTest.java`
- `backend/src/test/java/com/myqaweb/feature/TestCaseControllerTest.java`

**CompanyController 시나리오:**

| Endpoint | 테스트 | 기대 응답 |
|----------|--------|----------|
| `GET /api/companies` | `list_returnsOk` | 200 |
| `POST /api/companies` | `create_returns201` | 201 |
| `POST /api/companies` | `create_returns400WhenNameBlank` | 400 |
| `PATCH /api/companies/{id}/activate` | `activate_returnsOk` | 200 |
| `DELETE /api/companies/{id}` | `delete_returnsOk` | 200 |

**ProductController 시나리오:**

| Endpoint | 테스트 | 기대 응답 |
|----------|--------|----------|
| `GET /api/products?companyId={id}` | `listByCompany_returnsOk` | 200 |
| `POST /api/products` | `create_returns201` | 201 |
| `POST /api/products` | `create_returns400WhenNameBlank` | 400 |
| `PUT /api/products/{id}` | `update_returnsOk` | 200 |
| `DELETE /api/products/{id}` | `delete_returnsOk` | 200 |

**SegmentController 시나리오:**

| Endpoint | 테스트 | 기대 응답 |
|----------|--------|----------|
| `GET /api/segments?productId={id}` | `listByProduct_returnsOk` | 200 |
| `POST /api/segments` | `create_returns201` | 201 |
| `POST /api/segments` | `createChild_returns201` | 201 (parentId 포함) |
| `PUT /api/segments/{id}` | `update_returnsOk` | 200 |
| `DELETE /api/segments/{id}` | `delete_returnsOk` | 200 |

**TestCaseController 시나리오:**

| Endpoint | 테스트 | 기대 응답 |
|----------|--------|----------|
| `GET /api/test-cases?productId={id}` | `listByProduct_returnsOk` | 200 |
| `POST /api/test-cases` | `create_returns201` | 201 |
| `PUT /api/test-cases/{id}` | `update_returnsOk` | 200 |
| `DELETE /api/test-cases/{id}` | `delete_returnsOk` | 200 |
| `POST /api/test-cases/generate-draft` | `generateDraft_returnsOk` | 200 + AI 생성 결과 |

---

### 4. E2E API Tests (3개 신규)

**신규 파일:**
- `qa/api/kb.spec.ts`
- `qa/api/convention.spec.ts`
- `qa/api/senior-faq.spec.ts`

**KB API E2E (`qa/api/kb.spec.ts`):**
- `GET /api/kb` → 200, 빈 리스트 또는 기존 데이터
- `POST /api/kb` → 201, manual KB entry 생성
- `GET /api/kb/{id}` → 200, 생성한 entry 조회
- `PUT /api/kb/{id}` → 200, title/content 수정
- `DELETE /api/kb/{id}` → 200, 삭제 후 재조회 시 404
- `GET /api/kb/jobs` → 200, job 리스트

**Convention API E2E (`qa/api/convention.spec.ts`):**
- `GET /api/conventions` → 200
- `POST /api/conventions` → 201, convention 생성
- `GET /api/conventions/{id}` → 200
- `PUT /api/conventions/{id}` → 200, term 수정
- `DELETE /api/conventions/{id}` → 200

**Senior FAQ API E2E (`qa/api/senior-faq.spec.ts`):**
- `GET /api/senior/faq` → 200
- `POST /api/senior/faq` → 201, FAQ 생성
- `GET /api/senior/faq/{id}` → 200
- `PUT /api/senior/faq/{id}` → 200, title/content 수정
- `DELETE /api/senior/faq/{id}` → 200

---

## 검증

```bash
# Backend unit tests
cd backend && ./gradlew test

# E2E API tests (full stack 필요)
docker compose up -d && sleep 10
cd qa && npx playwright test
docker compose down
```

---

## 실행 결과

**실행일:** 2026-03-26
**결과:** BUILD SUCCESSFUL — 138개 테스트 전체 통과 (기존 ~65 + 신규 ~73)

### 생성된 파일 (Backend Unit Tests — 7개)

| 파일 | 테스트 수 |
|------|----------|
| `convention/ConventionServiceImplTest.java` | 10 |
| `convention/ConventionControllerTest.java` | 9 |
| `knowledgebase/KnowledgeBaseControllerTest.java` | 13 |
| `feature/CompanyControllerTest.java` | 7 |
| `feature/ProductControllerTest.java` | 5 |
| `feature/SegmentControllerTest.java` | 7 |
| `feature/TestCaseControllerTest.java` | 5 |

### 생성된 파일 (E2E API Tests — 3개)

| 파일 | 테스트 수 |
|------|----------|
| `qa/api/kb.spec.ts` | 8 |
| `qa/api/convention.spec.ts` | 8 |
| `qa/api/senior-faq.spec.ts` | 8 |

### 추가 수정

| 파일 | 변경 내용 |
|------|----------|
| `src/test/resources/logback-test.xml` | 신규 — 테스트 환경에서 FILE appender 제외 (기존 logback-spring.xml이 /app/logs 경로에 쓰려 해 테스트 실패 방지) |
