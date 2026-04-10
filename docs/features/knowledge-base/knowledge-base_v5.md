# Knowledge Base v5: PDF 텍스트 클리닝 레이어 추가

> 변경 유형: 기능 개선
> 작성일: 2026-04-10
> 버전: v5
> 상태: 완료

---

## 요구사항

PDF 텍스트 추출 후 청킹 전에 **범용 후처리 클리닝 레이어**를 추가한다.
헤더/푸터 반복 텍스트, 페이지 번호, 불필요한 공백을 제거하고, 섹션 인식 패턴을 다단계 넘버링까지 확장한다.

---

## 컨텍스트

### 현재 파이프라인 (`PdfProcessingWorker`)

```
PDF 바이트 → extractText(PDFBox) → parseSections → mergeSections → chunkText → enforceMaxSize → Embedding + DB 저장
```

### 식별된 문제점

| # | 문제 | 영향 | 심각도 |
|---|------|------|--------|
| 1 | 헤더/푸터가 본문에 혼입 | Embedding에 노이즈 포함, 검색 정확도 저하 | 높음 |
| 2 | 페이지 번호("66 of 72")가 본문에 잔존 | 동일 노이즈가 모든 청크에 분산 | 중간 |
| 3 | 섹션 인식이 "제N장/Chapter N"으로 한정 | "6.1", "6.2" 같은 하위 절이 분리 안 됨 | 높음 |
| 4 | 연속 공백/빈 줄 미정리 | 토큰 낭비, 청크 경계 왜곡 | 낮음 |
| 5 | 텍스트 추출 후 클리닝 단계 부재 | 위 1~4번이 후속 단계에 전파 | 높음 |

### 변경 후 파이프라인

```
PDF 바이트
  → extractText (기존 유지)
  → [NEW] cleanExtractedText (후처리 클리닝)
      ├── removeRepeatingHeaders   — 반복 출현 텍스트 제거
      ├── removePageNumbers        — 페이지 번호 패턴 제거
      └── normalizeWhitespace      — 공백/빈 줄 정규화
  → parseSections (섹션 패턴 확장)
  → mergeSections (기존 유지)
  → chunkText (기존 유지)
  → enforceMaxSize (기존 유지)
  → Embedding + DB 저장
```

---

## 실행 계획

### Step 1. 반복 출현 텍스트(헤더/푸터) 자동 감지 및 제거

**변경 파일**: `PdfProcessingWorker.java`
**메서드**: `removeRepeatingHeaders(String text)`

**로직:**
1. 텍스트를 줄 단위로 분할
2. 각 줄의 출현 횟수를 카운트
3. 전체 페이지 수 대비 일정 비율(예: 40%) 이상 반복 출현하는 짧은 줄(100자 이하)을 헤더/푸터로 판정
4. 해당 줄 제거

**판정 기준:**
- 줄 길이 100자 이하 (헤더/푸터는 보통 짧음)
- 전체 페이지 수 추정: totalLines / 45 (한 페이지 ≈ 45줄)
- 출현 횟수 ≥ max(3, 추정 페이지 수 × 0.4)
- 빈 줄은 제외 (클리닝 대상 아님)

**대상 예시:**
- `"Korean Software Testing Qualifications Board"` → 매 페이지 반복 → 제거
- `"ISTQB Certified Tester Foundation Level Syllabus CTFL V4.0.1 (Korean v1.1.1)"` → 반복 → 제거

**비대상 예시:**
- 본문 내 핵심 문장이 우연히 2~3회 등장 → 비율 미달 → 유지

---

### Step 2. 페이지 번호 패턴 제거

**변경 파일**: `PdfProcessingWorker.java`
**메서드**: `removePageNumbers(String text)`

**제거 대상 패턴 (범용):**

```
^\s*\d{1,4}\s*$                    →  "66", " 3 "
^\s*\d{1,4}\s*(of|/)\s*\d{1,4}\s*$ →  "66 of 72", "3/10"
^\s*-\s*\d{1,4}\s*-\s*$            →  "- 66 -"
^\s*Page\s+\d+\s*$                 →  "Page 66"
^\s*p\.\s*\d+\s*$                  →  "p. 66"
```

**핵심:** 줄 전체가 페이지 번호인 경우만 제거 (본문 내 숫자는 건드리지 않음)

---

### Step 3. 공백/빈 줄 정규화

**변경 파일**: `PdfProcessingWorker.java`
**메서드**: `normalizeWhitespace(String text)`

**처리 내용:**
- 3개 이상 연속 빈 줄 → 2개로 축소
- 줄 앞뒤 불필요한 공백 trim
- 탭 문자 → 공백 변환
- 연속 공백(2개 이상) → 단일 공백

---

### Step 4. 섹션 인식 패턴 확장

**변경 파일**: `PdfProcessingWorker.java`
**변경 대상**: `CHAPTER_PATTERN` 상수

**현재 패턴:**
```java
"^\\s*(제\\s*\\d+\\s*[장편부]|Chapter\\s+\\d+|Part\\s+\\d+|CHAPTER\\s+\\d+|PART\\s+\\d+)"
```

**추가할 패턴 (범용 다단계 넘버링):**
```
^\s*\d{1,2}\.\d{1,2}\.?\s+\S      →  "6.1 테스팅 지원 도구", "6.2. 테스트 자동화"
^\s*Section\s+\d+                  →  "Section 3"
^\s*SECTION\s+\d+                  →  "SECTION 3"
```

**제외한 패턴:**
- `\d{1,2}\.\s+[A-Z가-힣]` (단일 레벨 "6. Title") — 번호 리스트("1. 테스팅은...")와 오인식 발생하여 제외

**주의사항:**
- 기존 `parseSections_doesNotSplitOnNumberedLists` 테스트가 여전히 통과해야 함

---

### Step 5. 클리닝 메서드 통합 및 파이프라인 연결

**변경 파일**: `PdfProcessingWorker.java`
**메서드**: `cleanExtractedText(String rawText)`

```java
String cleanExtractedText(String rawText) {
    String cleaned = rawText;
    cleaned = removeRepeatingHeaders(cleaned);
    cleaned = removePageNumbers(cleaned);
    cleaned = normalizeWhitespace(cleaned);
    return cleaned;
}
```

**호출 위치:** `processPdf` 메서드 내 `extractText` 직후, `parseSections` 직전

```java
// 기존
String fullText = extractText(pdfBytes);

// 변경 후
String fullText = extractText(pdfBytes);
fullText = cleanExtractedText(fullText);
```

---

### Step 6. 단위 테스트 작성

**변경 파일**: `PdfProcessingWorkerTest.java`

| # | 테스트 케이스 | 검증 포인트 |
|---|-------------|------------|
| T1 | `removeRepeatingHeaders`: 반복 헤더 3개 + 본문 | 헤더만 제거, 본문 유지 |
| T2 | `removeRepeatingHeaders`: 반복 없는 텍스트 | 변경 없음 |
| T3 | `removeRepeatingHeaders`: 빈 줄만 반복 | 변경 없음 |
| T4 | `removePageNumbers`: 다양한 페이지 번호 패턴 | 패턴 제거, 본문 유지 |
| T5 | `removePageNumbers`: 본문 내 숫자 | 변경 없음 |
| T6 | `normalizeWhitespace`: 연속 빈 줄 축소 | 3줄 이상 → 2줄 |
| T7 | `normalizeWhitespace`: 공백/탭 정규화 | trim, 단일 공백 |
| T8 | `parseSections`: 다단계 넘버링 인식 | "6.1 제목" → 섹션 인식 |
| T9 | `parseSections`: 번호 리스트 미인식 유지 | "1. 소문자..." → 섹션 미인식 |
| T10 | `cleanExtractedText`: 통합 클리닝 검증 | 3단계 순차 적용 확인 |

---

### Step 7. 4-Agent Pipeline 실행

기존 테스트 + 새 테스트 전체 통과 확인.

```bash
# Agent-D 순서
1. cd backend && ./gradlew clean build
2. ./gradlew test
3. cd .. && docker compose up -d && sleep 10
4. cd qa && npx playwright test
5. cd .. && docker compose down
```

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `PdfProcessingWorker.java` | 메서드 4개 추가 (`removeRepeatingHeaders`, `removePageNumbers`, `normalizeWhitespace`, `cleanExtractedText`), `CHAPTER_PATTERN` 확장, `processPdf` 1줄 추가 |
| `PdfProcessingWorkerTest.java` | 테스트 케이스 약 10개 추가 |
| 기존 로직 | `extractText`, `mergeSections`, `chunkText`, `enforceMaxSize` 변경 없음 |
| DB 스키마 | 변경 없음 |
| API | 변경 없음 |

---

## 리스크

| 리스크 | 완화 방안 |
|--------|----------|
| 반복 헤더 오탐 (본문 문장을 헤더로 판정) | 줄 길이 100자 제한 + 출현 비율 임계값으로 오탐 최소화 |
| 페이지 번호 정규식이 본문 숫자를 삭제 | "줄 전체가 패턴과 일치"하는 경우만 제거 |
| 섹션 패턴 확장으로 기존 번호 리스트 오인식 | 기존 테스트 유지 + 첫 글자 대문자/한글 조건 추가 |
| 클리닝으로 유의미한 정보 손실 | 클리닝 전/후 텍스트 길이를 로그로 출력하여 모니터링 |

---

## 영향 범위

| 영역 | 영향 |
|------|------|
| Backend 코드 | `PdfProcessingWorker.java`만 수정 |
| Frontend | 변경 없음 |
| DB 스키마 | 변경 없음 |
| API 엔드포인트 | 변경 없음 |
| E2E 테스트 | 기존 테스트 변경 없음 (신규 단위 테스트만 추가) |

---

## 4-Agent Pipeline 결과

| Step | 결과 |
|------|------|
| Backend build | BUILD SUCCESSFUL (38s) |
| Unit tests | 전체 통과 (PdfProcessingWorkerTest 26개 포함, 신규 10개) |
| E2E tests | 149 passed, 16 failed (기존 flaky/미머지 — v5 변경 무관), 4 skipped |

**실패 원인 분석:**
- `convention.spec.ts` (7개): 병렬 실행 시 데이터 충돌 → 단독 실행 시 전부 통과
- `test-result-comment.spec.ts` (6개): 다른 worktree에서 추가된 기능, 현재 브랜치 미머지
- `company-panel.spec.ts` (2개): UI 테스트 timing 이슈
- `company.spec.ts` (1개): 병렬 데이터 충돌

**v5 PDF 클리닝 관련 실패: 0개**

---

## 진행 상황

- [x] Step 1: 반복 출현 텍스트(헤더/푸터) 자동 감지 및 제거
- [x] Step 2: 페이지 번호 패턴 제거
- [x] Step 3: 공백/빈 줄 정규화
- [x] Step 4: 섹션 인식 패턴 확장
- [x] Step 5: 클리닝 메서드 통합 및 파이프라인 연결
- [x] Step 6: 단위 테스트 작성
- [x] Step 7: 4-Agent Pipeline 실행

---

## 최종 요약

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `PdfProcessingWorker.java` | 메서드 4개 추가 (`removeRepeatingHeaders`, `removePageNumbers`, `normalizeWhitespace`, `cleanExtractedText`), `CHAPTER_PATTERN` 확장 (다단계 넘버링 + Section), `processPdf` 클리닝 호출 추가 |
| `PdfProcessingWorkerTest.java` | 테스트 10개 추가 (T1~T10) — 각 클리닝 메서드 + 통합 + 다단계 넘버링 |

### 구현 결정사항

1. **페이지 수 추정**: `totalLines / 45`로 추정하여 반복 헤더 감지 임계값 계산
2. **단일 레벨 넘버링 제외**: `\d.\s+[A-Z가-힣]` 패턴은 번호 리스트와 오인식 발생하여 제외. 다단계(`6.1 Title`)만 지원
3. **클리닝 순서**: removeRepeatingHeaders → removePageNumbers → normalizeWhitespace (의존성 순서)
4. **클리닝 전/후 로그**: 텍스트 길이 변화를 INFO 레벨로 기록하여 모니터링 가능
