# Knowledge Base — 버그 수정 (v0.1)

> 변경 유형: 버그 수정  
> 작성일: 2026-03-25  
> 버전: v0.1  
> 상태: 완료

---

## 1. 변경 배경

PDF 업로드 시 2가지 문제 발생:

### 문제 1: API 응답이 수 분간 pending 상태
`PdfPipelineServiceImpl.startUpload()`에서 같은 클래스의 `processPdf()`를 직접 호출하여 Spring `@Async` 프록시가 우회됨. PDF 처리(텍스트 추출 + 수백 개 임베딩)가 HTTP 요청 스레드에서 동기 실행.

### 문제 2: OpenAI Rate Limit 429 에러
수백 개 청크를 쉬지 않고 연속 호출하여 TPM(Tokens Per Minute) 40,000 한도 초과.
```
429 - Rate limit reached for text-embedding-3-small: Limit 40000, Used 39352, Requested 154
```

---

## 2. 변경 내용

### 변경 파일 목록

| 파일 | 변경 사항 |
|------|-----------|
| `PdfProcessingWorker.java` | **신규** — @Async 비동기 처리 + rate limit 대응 (200ms sleep, 429시 5초 retry) |
| `PdfPipelineServiceImpl.java` | Worker 주입, processPdf 및 헬퍼 메서드 제거 |
| `PdfPipelineServiceImplTest.java` | Worker mock 추가, 이동된 테스트 제거 |
| `PdfProcessingWorkerTest.java` | **신규** — parseSections/chunkText 테스트 이동 |

### 상세

**근본 원인**: Spring `@Async`는 같은 클래스 내부 호출(self-invocation)에서 프록시를 우회하여 동기 실행됨.

**해결**: `processPdf()` 로직을 별도 `@Component`인 `PdfProcessingWorker`로 분리. 외부 빈 호출이므로 `@Async` 프록시가 정상 동작.

**Rate Limit 대응**:
- 청크 간 200ms sleep
- 429 에러 시 5초 대기 후 최대 3회 retry
- retry 실패한 청크는 skip (성공분 보존)

---

## 3. 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | PDF 업로드 API 호출 | jobId 즉시 반환 (pending 아님) |
| 2 | 3초 polling | PENDING → PROCESSING → DONE 상태 전환 |
| 3 | 대용량 PDF (수백 청크) | Rate limit 없이 처리 완료 |
| 4 | KB 목록 | [도서] 뱃지 청크 노출 |
