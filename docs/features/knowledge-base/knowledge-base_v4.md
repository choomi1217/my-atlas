# Knowledge Base v4: PDF 청킹 파이프라인 검증 및 개선

> 변경 유형: 버그 수정
> 작성일: 2026-04-08
> 버전: v4
> 상태: 대기 (v3 완료 후 진행)

---

## 요구사항

### PDF 청크 내용을 검증해주세요.
KB를 통해 `ISTQB_CTFL` PDF를 청크 했습니다. (pdf 파일 경로 : /Users/yeongmi/dev/qa/my-atlas/docs/features/knowledge-base/pdf/ISTQB_CTFL.pdf)
하지만 기대한 결과와 조금 다른것 같아요. 해당 내용을 검증 해주세요.

---

## 컨텍스트

### PDF 청킹 파이프라인 (`PdfProcessingWorker.java`)
- 텍스트 추출: PDFBox `PDFTextStripper`
- 섹션 파싱: `CHAPTER_PATTERN` 정규식 (제X장, Chapter X, Part X, X. 대문자)
- 청킹: 슬라이딩 윈도우 (500~800 tokens, 50 overlap)
- 문장 분리: `(?<=[.!?。])(\s+)` 패턴

---

## 실행 계획

### Step 1. PDF 청크 검증
- [ ] ISTQB_CTFL PDF에서 PDFBox로 추출한 원문 텍스트 확인
- [ ] `parseSections()` 결과 검증 (챕터가 정상 분리되는지)
- [ ] `chunkText()` 결과 검증 (청크 크기, 문장 경계, 오버랩 품질)
- [ ] 문제점 분석 및 개선안 도출

### Step 2. (Step 1 결과에 따라) PDF 청킹 로직 개선
- [ ] 섹션 파싱 패턴 개선 (ISTQB 문서 구조에 맞게)
- [ ] 청킹 품질 개선

### Step 3. 테스트 및 검증
- [ ] Backend 빌드 확인
- [ ] 단위 테스트 작성/수정
- [ ] 4-Agent Pipeline 실행

---

## 진행 상황
