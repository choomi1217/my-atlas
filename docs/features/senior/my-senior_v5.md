> 변경 유형: 기능 개선  
> 작성일: 2026-04-08  
> 버전: v5  
> 상태: 완료

---

# RAG 컨텍스트에서 Company Features / Conventions 제거

## 배경

현재 `SeniorServiceImpl.buildRagContext()`는 아래 6개 소스를 시스템 프롬프트에 주입한다:

| # | 소스 | 방식 |
|---|------|------|
| 0 | 사용자 선택 FAQ | 직접 주입 |
| 1 | **Company Features (회사/제품/세그먼트)** | DB 전체 조회 |
| 2 | KB 수동 작성 | 벡터 검색 Top 3 |
| 3 | KB PDF 청크 | 벡터 검색 Top 2 |
| 4 | FAQ 유사도 검색 | 벡터 검색 Top 3 |
| 5 | **Terminology Conventions** | DB 전체 조회 |

**1번(Company Features)과 5번(Conventions)을 RAG 컨텍스트에서 제거한다.**

## 이유

- 사용자가 요청하지 않은 컨텍스트가 프롬프트에 포함되고 있음
- 회사/제품 구조와 용어 컨벤션은 QA 채팅 답변에 불필요한 노이즈
- 불필요한 토큰을 줄여 KB/FAQ 검색 결과의 비중을 높임

## 변경 대상

### 파일: `backend/src/main/java/com/myqaweb/senior/SeniorServiceImpl.java`

### 변경 1: `buildRagContext()` (Line 143-173)

**Before:**
```java
private String buildRagContext(String userMessage, ChatDto.FaqContext faqContext) {
    StringBuilder sb = new StringBuilder();
    sb.append("You are a Senior QA Engineer AI assistant. ");
    sb.append("Answer the user's QA-related questions using the following context.\n\n");

    if (faqContext != null) {
        sb.append("=== FAQ 참고 항목 (사용자가 선택한 항목) ===\n");
        sb.append("제목: ").append(faqContext.title()).append("\n");
        sb.append("내용: ").append(faqContext.content()).append("\n\n");
    }

    // 1. Company Features (active company → products → segments)
    appendCompanyFeatures(sb);                          // ← 제거

    // 2. Knowledge Base (vector similarity search)
    appendKnowledgeBase(sb, userMessage);

    // 3. FAQ / Personal Notes (vector similarity search)
    appendFaqContext(sb, userMessage);

    // 4. Terminology Conventions (all)
    appendConventions(sb);                              // ← 제거

    sb.append("Use the above context for accurate, company-specific QA guidance. ");
    sb.append("If the context doesn't contain relevant information, use your general QA expertise. ");
    sb.append("Always use the terminology conventions when applicable. ");  // ← 수정
    sb.append("Respond in the same language as the user's question.");

    return sb.toString();
}
```

**After:**
```java
private String buildRagContext(String userMessage, ChatDto.FaqContext faqContext) {
    StringBuilder sb = new StringBuilder();
    sb.append("You are a Senior QA Engineer AI assistant. ");
    sb.append("Answer the user's QA-related questions using the following context.\n\n");

    if (faqContext != null) {
        sb.append("=== FAQ 참고 항목 (사용자가 선택한 항목) ===\n");
        sb.append("제목: ").append(faqContext.title()).append("\n");
        sb.append("내용: ").append(faqContext.content()).append("\n\n");
    }

    // 1. Knowledge Base (vector similarity search)
    appendKnowledgeBase(sb, userMessage);

    // 2. FAQ / Personal Notes (vector similarity search)
    appendFaqContext(sb, userMessage);

    sb.append("Use the above context for accurate QA guidance. ");
    sb.append("If the context doesn't contain relevant information, use your general QA expertise. ");
    sb.append("Respond in the same language as the user's question.");

    return sb.toString();
}
```

### 변경 2: 미사용 메서드 및 import 제거

`buildRagContext()`에서 더 이상 호출하지 않으므로 아래를 제거한다:

- `appendCompanyFeatures()` 메서드 (Line 175-198) — 전체 삭제
- `appendConventions()` 메서드 (Line 249-258) — 전체 삭제
- 미사용 필드/import 정리:
  - `companyRepository` — `buildRagContext`에서만 사용하는 경우 제거
  - `segmentRepository` — `appendCompanyFeatures`에서만 사용하는 경우 제거
  - `conventionRepository` — `appendConventions`에서만 사용하는 경우 제거
  - `productRepository` — `appendCompanyFeatures`에서만 사용하는 경우 제거

> **주의:** 위 Repository들이 다른 메서드에서도 사용되는지 반드시 확인 후 제거할 것.

### 변경 3: 시스템 프롬프트 문구 수정

| Before | After |
|--------|-------|
| "company-specific QA guidance" | "accurate QA guidance" |
| "Always use the terminology conventions when applicable." | (삭제) |

## 변경 후 RAG 파이프라인

```
사용자 질문
    ↓
① 사용자 선택 FAQ (있는 경우 직접 주입)
    ↓
② KB 수동 작성 → 벡터 검색 Top 3
③ KB PDF 청크 → 벡터 검색 Top 2
    ↓
④ FAQ 유사도 검색 → Top 3
    ↓
⑤ Claude 답변 생성
```

## 영향 범위

- **Backend**: `SeniorServiceImpl.java`만 변경
- **Frontend**: 변경 없음
- **DB**: 변경 없음
- **테스트**: `SeniorServiceImpl` 관련 단위 테스트에서 Company/Convention 관련 mock 제거 필요

## Steps

- [x] Step 1: `buildRagContext()`에서 `appendCompanyFeatures(sb)` 호출 제거 ✅
- [x] Step 2: `buildRagContext()`에서 `appendConventions(sb)` 호출 제거 ✅
- [x] Step 3: 시스템 프롬프트 문구 수정 ✅
- [x] Step 4: 미사용 메서드(`appendCompanyFeatures`, `appendConventions`) 삭제 ✅
- [x] Step 5: 미사용 Repository 필드/import 정리 (companyRepository, productRepository, segmentRepository, conventionRepository 모두 제거) ✅
- [x] Step 6: 관련 단위 테스트 수정 (Company/Convention mock 제거, activeCompany 테스트 삭제) ✅
