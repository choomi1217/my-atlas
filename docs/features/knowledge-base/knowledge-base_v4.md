# Knowledge Base v4: PDF 청킹 파이프라인 개선

> 변경 유형: 버그 수정
> 작성일: 2026-04-09
> 버전: v4
> 상태: 완료

---

## 요구사항

ISTQB_CTFL PDF 청킹 결과가 기대와 다르다. qa_v9에서 발견된 4가지 문제를 코드 레벨에서 해결한다.
개발 완료 후 QA가 qa_v9의 Stage 1~3 검증을 수행한다.

---

## 컨텍스트

### qa_v9에서 발견된 4가지 문제

| # | 문제 | 증상 | 원인 (코드 분석) |
|---|------|------|-----------------|
| 1 | 목차 오인식 | 목차의 "제 1장..." 텍스트가 챕터 시작으로 오판 → 148자짜리 의미없는 청크 생성 | `CHAPTER_PATTERN`이 목차와 본문을 구분하지 못함 |
| 2 | 번호 리스트 분리 | "1. 테스팅은..." 같은 번호 리스트가 섹션 구분으로 오인 → 7원칙이 7개 청크로 분리 | `CHAPTER_PATTERN`의 `\\d+\\.\\s+[A-Z가-힣]` 패턴이 너무 광범위 |
| 3 | 중복 이름 | "ISTQB_CTFL - chunk - 001"이 7개 존재 | `buildChunkTitle()`에서 섹션별 순번이 리셋됨 |
| 4 | 크기 편차 | 26자 ~ 5,616자 (216배 차이) | 소형 섹션이 그대로 단일 청크가 되고, 대형 섹션 분할이 부족 |

### 문제 1 근본 원인: 왜 목차를 완벽하게 청킹할 수 없는가?

PDF는 **"보이는 그대로의 문서"(What You See Is What You Get)** 포맷이다.
Word나 HTML과 달리, PDF 내부에는 "여기가 목차다", "여기가 본문이다"라는 **의미 구조(semantic structure)가 없다.**
글자의 위치(x, y 좌표)와 폰트 정보만 있을 뿐이다.

PDFBox의 `PDFTextStripper`는 이 좌표 정보를 바탕으로 **위에서 아래로, 왼쪽에서 오른쪽으로** 텍스트를 추출한다.
추출 결과는 아래처럼 구조 없는 **평문(flat text)** 이 된다:

```
[목차 페이지에서 추출된 텍스트]
제 1장 테스팅의 기초(Fundamentals of Testing) ........................................................................... 13
1.1. 테스팅이란 무엇인가? ....................................................................................................................................... 15
1.2. 테스팅이 왜 필요한가? ..................................................................................................................................... 16
...

[13페이지 본문에서 추출된 텍스트]
제 1장 테스팅의 기초(Fundamentals of Testing)
학습 목표: 1.1 테스팅이란 무엇인가? FL-1.1.1 (K1) 테스팅의 정의
...
```

정규식 `CHAPTER_PATTERN`이 `"제 1장"`을 만나면, 그것이 **목차의 한 줄인지 본문의 챕터 제목인지 구분할 방법이 없다.**
텍스트만 보면 둘 다 동일하게 `"제 1장 테스팅의 기초..."` 이기 때문이다.

실제 ISTQB PDF의 PDFBox 추출 결과에서 `"제 N장"` 패턴이 등장하는 위치:

| 등장 위치 | 텍스트 | 실제 의미 |
|-----------|--------|-----------|
| 67행 | `제 1장 테스팅의 기초... 13` | **목차** (페이지 번호 포함) |
| 86행 | `제 2장 소프트웨어 개발수명주기... 25` | **목차** |
| ~300행 이후 | `제 1장 테스팅의 기초(Fundamentals of Testing)` | **본문** 챕터 시작 |

**즉, 같은 "제 1장" 패턴이 목차에서 1번, 본문에서 1번, 총 2번 등장한다.**
정규식은 두 번 다 매칭하므로, 목차의 "제 1장" ~ 다음 "제 2장" 사이 텍스트(절 목록 나열)가 하나의 섹션이 되어 148자짜리 의미없는 청크가 만들어진다.

**이것은 PDFBox의 한계이지 버그가 아니다.** OCR 기반 도구(예: Adobe API, Amazon Textract)도 동일한 문제를 겪는다.
해결 방법은 **추출 후 후처리**로, 소형 섹션을 병합하거나 목차 영역을 휴리스틱으로 감지하여 제거하는 것이다.

### 현재 코드 (`PdfProcessingWorker.java`)

```java
// 문제 2의 원인 — 번호 리스트까지 매칭하는 광범위한 패턴
private static final Pattern CHAPTER_PATTERN = Pattern.compile(
    "^\\s*(제?\\s*\\d+\\s*[장절편부]|Chapter\\s+\\d+|Part\\s+\\d+|CHAPTER\\s+\\d+|PART\\s+\\d+|\\d+\\.\\s+[A-Z가-힣])",
    Pattern.MULTILINE
);

// 문제 3의 원인 — 섹션별 순번 리셋
for (Section section : sections) {
    List<String> chunkTexts = chunkText(section.content());
    for (int i = 0; i < chunkTexts.size(); i++) {
        String title = buildChunkTitle(bookTitle, section.name(), i + 1);  // i+1: 섹션 내 순번
    }
}

// 문제 1, 4의 원인 — 소형 섹션 필터링/병합 없음, 대형 청크 강제 분할 없음
```

---

## 실행 계획

### Step 1. CHAPTER_PATTERN 정규식 개선 (문제 1, 2 해결)

**변경 파일**: `PdfProcessingWorker.java`

**현재 패턴의 문제**:
- `\\d+\\.\\s+[A-Z가-힣]` → "1. 테스팅은...", "2. 완벽한..." 같은 번호 리스트까지 매칭
- 목차/본문 구분 불가

**개선 방향**:
- 번호 리스트 패턴(`\\d+\\.\\s+[A-Z가-힣]`) 제거
- 명확한 챕터 헤더만 인식하도록 패턴을 구체화
- 변경 후 패턴 예시:
  ```java
  // "제 N장", "제N장", "Chapter N", "CHAPTER N", "Part N", "PART N" 만 인식
  // "1. 대문자..." 같은 번호 리스트는 매칭하지 않음
  private static final Pattern CHAPTER_PATTERN = Pattern.compile(
      "^\\s*(제\\s*\\d+\\s*[장편부]|Chapter\\s+\\d+|Part\\s+\\d+|CHAPTER\\s+\\d+|PART\\s+\\d+)",
      Pattern.MULTILINE
  );
  ```
- `절`도 제거 — ISTQB 같은 문서에서 "제1절"은 너무 세밀한 분리를 유발

**기대 효과**:
- 목차의 "제 1장..." 행도 매칭되지만, Step 2의 소형 섹션 병합으로 해결
- 번호 리스트가 더 이상 섹션 구분으로 분리되지 않음

---

### Step 2. 소형 섹션 병합 로직 추가 (문제 1, 4 해결)

**변경 파일**: `PdfProcessingWorker.java` — `parseSections()` 이후 후처리

**현재 문제**: 목차에서 생성된 소형 섹션(148자)이 그대로 단일 청크가 됨

**개선 방향**: `parseSections()` 결과를 후처리하여 너무 작은 섹션을 다음 섹션에 병합

```java
// 새 메서드: mergeSections()
// MIN_SECTION_CHARS (200자) 미만인 섹션을 다음 섹션에 병합
List<Section> mergeSections(List<Section> sections) {
    // 200자 미만 섹션 → 다음 섹션의 content 앞에 붙임
    // 마지막 섹션이 소형이면 → 이전 섹션 뒤에 붙임
}
```

**적용 위치**: `processPdf()` 내부, parseSections → **mergeSections** → chunkText 순서

**상수 추가**:
```java
private static final int MIN_SECTION_CHARS = 200;
```

**기대 효과**:
- 목차 한 줄짜리 섹션이 본문 섹션에 흡수됨
- 26자, 80자 같은 초소형 청크 방지

---

### Step 3. 전역 순번으로 변경 (문제 3 해결)

**변경 파일**: `PdfProcessingWorker.java` — `processPdf()` 내 청크 생성 루프

**현재 문제**: 섹션별로 순번이 1부터 리셋 → 같은 이름의 청크 중복

**개선 방향**: 전체 PDF에서 연속 순번 사용

```java
// Before (섹션별 순번)
for (Section section : sections) {
    for (int i = 0; i < chunkTexts.size(); i++) {
        buildChunkTitle(bookTitle, section.name(), i + 1);  // 섹션마다 1부터
    }
}

// After (전역 순번)
int globalSeq = 1;
for (Section section : sections) {
    for (String chunkText : chunkTexts) {
        buildChunkTitle(bookTitle, section.name(), globalSeq++);  // 전체에서 연속
    }
}
```

**기대 효과**:
- "ISTQB_CTFL - 제 1장 ... - 001", "... - 002", ..., "... - 054" 전부 고유 이름
- 같은 이름의 청크 0개

---

### Step 4. 대형 청크 강제 분할 보강 (문제 4 해결)

**변경 파일**: `PdfProcessingWorker.java` — `chunkText()`

**현재 문제**: 문장 분리 패턴 `(?<=[.!?。])(\\s+)` 에 매칭되지 않는 긴 텍스트가 한 청크로 생성됨 (5,616자)

**개선 방향**:
- `chunkText()` 최종 결과에서 MAX_CHUNK_CHARS 초과 청크를 강제 분할하는 후처리 추가
- 문장 경계를 못 찾을 때를 대비한 안전망

```java
private static final int MAX_CHUNK_CHARS = 3000;

// chunkText() 끝에 후처리 추가
List<String> enforceMaxSize(List<String> chunks) {
    // MAX_CHUNK_CHARS 초과 시 단어 경계에서 분할
    // overlap 적용
}
```

**기대 효과**:
- 5,000자 이상 초대형 청크 방지
- 모든 청크가 200자 ~ 3,000자 범위 내

---

### Step 5. 단위 테스트 작성/수정

**변경 파일**: `PdfProcessingWorkerTest.java`

| # | 테스트 케이스 | 검증 포인트 |
|---|-------------|------------|
| T1 | parseSections: 번호 리스트를 섹션으로 분리하지 않음 | "1. 항목" 패턴이 섹션 구분 안 됨 |
| T2 | parseSections: "제N장"만 챕터로 인식 | "제1장", "Chapter 1"은 인식, "1. 대문자"는 미인식 |
| T3 | mergeSections: 200자 미만 섹션이 다음 섹션에 병합됨 | 소형 섹션 제거 확인 |
| T4 | mergeSections: 모든 섹션이 200자 이상이면 변경 없음 | 정상 섹션 보존 |
| T5 | chunkText + enforceMaxSize: 3,000자 초과 청크 강제 분할 | 분할 후 모든 청크 ≤ 3,000자 |
| T6 | 전역 순번: 전체 파이프라인에서 청크 이름 고유성 확인 | 중복 이름 0개 |
| T7 | ISTQB 실제 PDF로 통합 테스트 | parseSections 결과 검증 (test/resources에 PDF 배치) |

---

### Step 6. 4-Agent Pipeline 실행

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
|------|-----------|
| `PdfProcessingWorker.java` | CHAPTER_PATTERN 개선, mergeSections() 추가, 전역 순번, enforceMaxSize() 추가 |
| `PdfProcessingWorkerTest.java` | T1~T7 테스트 추가/수정 |

---

## 검증 기준 (개발 완료 판단)

개발 완료 후 QA가 qa_v9 Stage 1을 실행하여 아래 조건을 충족해야 한다:

| 기준 | 합격 조건 |
|------|-----------|
| 최소 크기 | 모든 조각 ≥ 200자 |
| 최대 크기 | 모든 조각 ≤ 3,000자 |
| 이름 고유성 | 동일 이름 조각 0개 |
| 임베딩 누락 | 임베딩 NULL 조각 0개 |
| 노이즈 | 목차 전용 조각 0개 |

---

## 4-Agent Pipeline 결과

| Step | 결과 |
|------|------|
| Backend build | BUILD SUCCESSFUL (22s) |
| Unit tests | 179 passed (PdfProcessingWorkerTest 12개 포함) |
| E2E tests | 161 passed, 3 failed (기존 pin/curated 테스트 — 이번 변경 무관), 4 skipped |

**실패 원인 분석**: kb-pin.spec.ts(2개), senior-faq.spec.ts(1개)는 다른 worktree에서 추가된 pin/curated 기능의 테스트. 현재 knowledge-base worktree에 해당 코드가 아직 머지되지 않아 실패. KB 청킹 관련 테스트는 전부 통과.

---

## 진행 상황

- [x] Step 1: CHAPTER_PATTERN 정규식 개선
- [x] Step 2: 소형 섹션 병합 로직 추가
- [x] Step 3: 전역 순번으로 변경
- [x] Step 4: 대형 청크 강제 분할 보강
- [x] Step 5: 단위 테스트 작성/수정
- [x] Step 6: 4-Agent Pipeline 실행

---

## QA 검증 결과 (qa_v9 Stage 1)

**검증일:** 2026-04-10
**QA 담당:** qa_v9 기준으로 Stage 1(조각 품질 검증) 실행

### 테스트 이력

| 차수 | 날짜 | 결과 | 원인 |
|------|------|------|------|
| 1차 | 04-09 | FAIL | Docker 미리빌드 → 구 로직으로 청킹 실행 |
| 2차 | 04-10 | FAIL | `@Transactional` 누락 → 임베딩 60개 전부 저장 실패 |
| 3차 | 04-10 | **PASS** | v4 코드 + `@Transactional` + Docker 리빌드 완료 |

### 3차 최종 결과

| 기준 | 이전 (구 로직) | v4 적용 후 | 합격 조건 | 판정 |
|------|---------------|-----------|-----------|------|
| 전체 조각 수 | 54 | **60** | - | - |
| 최소 글자 수 | 26자 | **300자** | ≥ 200자 | **PASS** |
| 최대 글자 수 | 5,616자 | **2,999자** | ≤ 3,000자 | **PASS** |
| 너무 작은 조각 | 9개 | **0개** | 0개 | **PASS** |
| 너무 큰 조각 | 21개 | **0개** | 0개 | **PASS** |
| 중복 이름 | 22건 | **0건** | 0건 | **PASS** |
| 임베딩 | 32개 NULL | **60/60 완료** | NULL 0개 | **PASS** |

### 추가 발견 이슈

- **`@Transactional` 누락**: `KnowledgeBaseRepository.updateEmbedding()`에 `@Transactional` 없이 `@Async` 워커에서 호출 → `@Modifying` native query 실행 불가. 개발자가 수정 완료.

### Stage 2~3 (검색 정확도 + 답변 품질)

Senior Chat API가 필요하여 knowledge-base worktree에서는 테스트 불가 (Anthropic API 400 에러).
**→ Senior worktree 환경에서 Stage 2~3 진행 예정** (qa_v9 Step 4~6)
