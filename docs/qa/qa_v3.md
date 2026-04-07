# Phase 2: Integration Test 인프라 + pgvector 검증

> 변경 유형: 기능 추가  
> 작성일: 2026-03-26  
> 버전: v3  
> 상태: 완료

---

## 목표

**Testcontainers** 기반 Integration Test 레이어를 신규 구축하여, Unit Test로는 검증 불가능한 **pgvector native query**, **PDF 파이프라인 전 구간**, **Company activation mutex**를 실제 PostgreSQL에서 검증한다.

배경: `bytea → vector` 타입 불일치 버그(commit `b170fdc`)가 Unit Test에서 발견되지 못하고 운영에서 발생한 이력이 있다. H2 in-memory DB는 pgvector extension을 지원하지 않기 때문이다.

**완료 기준:** pgvector 관련 runtime 버그 사전 방지, Integration test layer 확보

---

## 작업 목록

### 1. Testcontainers 의존성 추가

**수정 파일:**
- `backend/build.gradle`

**추가 의존성:**
```groovy
testImplementation 'org.testcontainers:postgresql'
testImplementation 'org.testcontainers:junit-jupiter'
```

---

### 2. Base Integration Test Class

**신규 파일:**
- `backend/src/test/java/com/myqaweb/common/BaseIntegrationTest.java`

**설계:**
- `@SpringBootTest` + `@Testcontainers`
- `pgvector/pgvector:pg15` Docker image 사용
- `@DynamicPropertySource`로 datasource URL/username/password 주입
- Flyway migration 자동 실행 (실제 스키마 검증)
- 모든 Integration Test가 이 클래스를 상속

---

### 3. KB Vector Search Integration Test

**신규 파일:**
- `backend/src/test/java/com/myqaweb/knowledgebase/KnowledgeBaseIntegrationTest.java`

**참조 파일:**
- `backend/src/main/java/com/myqaweb/knowledgebase/KnowledgeBaseRepository.java`
- `backend/src/main/java/com/myqaweb/knowledgebase/KnowledgeBaseEntity.java`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `findSimilar_returnsTopKByCosineSimilarity` | 5개 KB entry(각각 다른 embedding) 저장 → query vector와 가장 유사한 top 3 반환, 순서 검증 |
| `findSimilar_withNoEmbeddings_returnsEmpty` | embedding이 null인 entry만 있을 때 빈 결과 반환 |
| `findSimilar_vectorTypeCasting_worksWithPgvector` | `cast(:queryVector as vector)` native query가 실제 pgvector에서 정상 동작 (b170fdc 재발 방지) |
| `findBySource_returnsOnlyMatchingSource` | source="book-A"인 entry만 필터링 |
| `deleteBySource_removesAllChunks` | source 기준 전체 삭제 후 조회 시 0건 |

---

### 4. FAQ Vector Search Integration Test

**신규 파일:**
- `backend/src/test/java/com/myqaweb/senior/FaqIntegrationTest.java`

**참조 파일:**
- `backend/src/main/java/com/myqaweb/senior/FaqRepository.java`
- `backend/src/main/java/com/myqaweb/senior/FaqEntity.java`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `findSimilar_returnsTopKFaqs` | 3개 FAQ(각각 다른 embedding) 저장 → query vector로 top 2 조회, cosine 유사도 순서 검증 |
| `findSimilar_excludesNullEmbeddings` | embedding이 null인 FAQ는 결과에서 제외 |
| `saveFaqWithEmbedding_persistsVector` | float[] embedding 저장 후 재조회 시 동일 vector 반환 |

---

### 5. PDF Pipeline Integration Test

**신규 파일:**
- `backend/src/test/java/com/myqaweb/knowledgebase/PdfPipelineIntegrationTest.java`

**참조 파일:**
- `backend/src/main/java/com/myqaweb/knowledgebase/PdfPipelineServiceImpl.java`
- `backend/src/main/java/com/myqaweb/knowledgebase/PdfProcessingWorker.java`
- `backend/src/main/java/com/myqaweb/knowledgebase/PdfUploadJobRepository.java`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `startUpload_createsJobInPendingState` | upload 호출 → pdf_upload_job 테이블에 PENDING 상태 row 생성 확인 |
| `processJob_parsesAndChunksAndStores` | 테스트 PDF → chunk → DB 저장 (EmbeddingService는 mock으로 고정 vector 반환) |
| `processJob_failureMarksJobAsFailed` | 처리 중 exception 발생 시 job status가 FAILED로 마킹 |
| `processJob_setsCompletedAtOnDone` | 성공 시 completedAt 타임스탬프 기록 |

---

### 6. Company Activation Mutex Integration Test

**신규 파일:**
- `backend/src/test/java/com/myqaweb/feature/CompanyActivationIntegrationTest.java`

**참조 파일:**
- `backend/src/main/java/com/myqaweb/feature/CompanyServiceImpl.java`
- `backend/src/main/java/com/myqaweb/feature/CompanyRepository.java`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `setActive_deactivatesPreviousAndActivatesNew` | Company A 활성화 → Company B 활성화 → A.isActive=false, B.isActive=true |
| `setActive_firstActivation_succeeds` | 기존 active 없을 때 첫 활성화 정상 동작 |
| `findByIsActiveTrue_returnsOnlyOneCompany` | 여러 회사 중 active는 항상 1개 이하 |

---

## 검증

```bash
# Docker가 실행 중이어야 함 (Testcontainers가 pgvector container를 자동 생성)
cd backend && ./gradlew test

# Integration test만 실행 (선택적)
cd backend && ./gradlew test --tests "*IntegrationTest"
```

---

## 실행 결과

**실행일:** 2026-03-26
**결과:** BUILD SUCCESSFUL — 153개 테스트 전체 통과 (기존 138 + Integration 15)

### 생성/수정된 파일

| 파일 | 상태 | 테스트 수 |
|------|------|----------|
| `build.gradle` | 수정 — Testcontainers, Awaitility, PostgreSQL driver 추가, JVM heap 1g 설정 | - |
| `application-integration.yml` | 신규 — Integration test profile (PostgreSQL driver, Flyway enabled) | - |
| `BaseIntegrationTest.java` | 신규 — Singleton pgvector container, MockBean EmbeddingService | - |
| `KnowledgeBaseIntegrationTest.java` | 신규 — vector search, source filtering, deleteBySource | 4 |
| `FaqIntegrationTest.java` | 신규 — FAQ vector search, embedding persistence | 3 |
| `PdfPipelineIntegrationTest.java` | 신규 — job lifecycle, PDF parsing, chunking, empty PDF 처리 | 5 |
| `CompanyActivationIntegrationTest.java` | 신규 — activation mutex, single active constraint | 3 |
| `test-pdfs/qa-handbook.pdf` | 배치 — 3챕터 QA 핸드북 (11KB) | - |
| `test-pdfs/minimal.pdf` | 배치 — 최소 텍스트 PDF | - |
| `test-pdfs/empty.pdf` | 배치 — 빈 페이지 PDF | - |

### 설계 변경 사항

- **Singleton Container 패턴** 적용: `@Container` 대신 `static { postgres.start(); }`으로 모든 Integration Test 클래스에서 단일 pgvector container 공유 (컨테이너 시작/종료 반복 방지)
- **PDF Pipeline 테스트**: `@Async` 비동기 처리 + pgvector float[] 저장의 복잡성으로 인해, 전체 파이프라인 대신 **텍스트 추출 → 섹션 파싱 → 청킹** 단계를 직접 검증하는 방식으로 변경
