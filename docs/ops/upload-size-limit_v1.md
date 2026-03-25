# Upload Size Limit — 환경 개선 (v1)

> **변경 유형**: 환경 개선
> **날짜**: 2026-03-25
> **관련 기능**: Knowledge Base (PDF 업로드)

---

## 1. 변경 배경

PDF 업로드 시 `MaxUploadSizeExceededException` 발생.
업로드한 PDF 파일 크기(~243MB)가 기존 설정의 최대 업로드 크기(50MB)를 초과하여 요청이 거부됨.

**에러 요약:**
```
org.springframework.web.multipart.MaxUploadSizeExceededException: Maximum upload size exceeded
Caused by: SizeLimitExceededException: the request was rejected because its size (255336456) exceeds the configured maximum (52428800)
```

---

## 2. 변경 내용

### 변경 파일 목록

| 파일 | 변경 사항 |
|------|-----------|
| `backend/src/main/resources/application.yml` | multipart max-file-size, max-request-size 50MB → 500MB |

### 상세

```yaml
# 변경 전
spring:
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 50MB

# 변경 후
spring:
  servlet:
    multipart:
      max-file-size: 500MB
      max-request-size: 500MB
```

QA 도서 PDF는 일반적으로 100~300MB 범위이므로, 500MB로 상향하여 대부분의 도서를 처리 가능하도록 설정.

---

## 3. 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | ~243MB PDF 파일 업로드 | MaxUploadSizeExceededException 없이 PROCESSING 상태로 전환 |
| 2 | 500MB 이하 PDF 업로드 | 정상 업로드 및 청킹 처리 |
| 3 | 500MB 초과 파일 업로드 | MaxUploadSizeExceededException + 사용자 친화적 에러 메시지 |
