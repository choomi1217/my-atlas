package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for PdfProcessingWorker (chunking and parsing logic).
 */
@ExtendWith(MockitoExtension.class)
class PdfProcessingWorkerTest {

    @Mock
    private PdfUploadJobRepository jobRepository;

    @Mock
    private KnowledgeBaseRepository kbRepository;

    @Mock
    private EmbeddingService embeddingService;

    @InjectMocks
    private PdfProcessingWorker pdfProcessingWorker;

    // --- removeTocLines ---

    @Test
    void removeTocLines_removesDotLeaderLines() {
        String text = """
                1.1 테스트 프로세스 ............................................................................ 15
                1.2 테스팅의 정황 ................................................................................ 19
                이것은 본문 라인이라서 유지되어야 합니다.
                제 2장 제품 관리 ................................................................................ 47
                """;

        String result = pdfProcessingWorker.removeTocLines(text);

        assertFalse(result.contains("1.1 테스트 프로세스 .........."),
                "dot-leader 목차 라인이 제거되어야 함");
        assertFalse(result.contains("1.2 테스팅의 정황"),
                "두 번째 목차 라인도 제거되어야 함");
        assertFalse(result.contains("제 2장 제품 관리"),
                "챕터 제목이 붙은 목차 라인도 제거되어야 함");
        assertTrue(result.contains("이것은 본문 라인이라서 유지되어야 합니다"),
                "본문 라인은 유지되어야 함");
    }

    @Test
    void removeTocLines_preservesBodyWithInlineDots() {
        // 본문 내 짧은 점(…, ..)은 유지되어야 함
        String text = "참고: 1.2 섹션 참조. 자세한 내용은... 다음을 확인하시오.\n버전 1.0.0 이다.";

        String result = pdfProcessingWorker.removeTocLines(text);

        assertEquals(text, result, "본문 내 짧은 점은 변경되지 않아야 함");
    }

    @Test
    void removeTocLines_preservesPageNumberOnlyLines() {
        // 페이지 번호만 있는 라인은 removePageNumbers 담당 — removeTocLines는 건드리지 않음
        String text = "본문 내용\n66\n다음 본문";

        String result = pdfProcessingWorker.removeTocLines(text);

        assertEquals(text, result, "페이지 번호만 있는 라인은 removeTocLines에서 제거되지 않음");
    }

    // --- removeRepeatingHeaders ---

    @Test
    void removeRepeatingHeaders_removesRepeatedShortLines() {
        // T1: 반복 헤더 3개 + 본문 → 헤더만 제거
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append("ISTQB Foundation Level Syllabus\n");
            sb.append("Korean Software Testing Board\n");
            sb.append("본문 내용 라인 ").append(i).append("는 고유한 텍스트입니다.\n");
        }

        String result = pdfProcessingWorker.removeRepeatingHeaders(sb.toString());

        assertFalse(result.contains("ISTQB Foundation Level Syllabus"),
                "반복 헤더가 제거되어야 함");
        assertFalse(result.contains("Korean Software Testing Board"),
                "반복 푸터가 제거되어야 함");
        assertTrue(result.contains("본문 내용 라인 0"),
                "본문은 유지되어야 함");
        assertTrue(result.contains("본문 내용 라인 9"),
                "본문은 유지되어야 함");
    }

    @Test
    void removeRepeatingHeaders_noChangeWhenNoRepeats() {
        // T2: 반복 없는 텍스트 → 변경 없음
        String text = "첫 번째 줄입니다.\n두 번째 줄입니다.\n세 번째 줄입니다.";

        String result = pdfProcessingWorker.removeRepeatingHeaders(text);

        assertEquals(text, result);
    }

    @Test
    void removeRepeatingHeaders_ignoresBlankLines() {
        // T3: 빈 줄만 반복 → 변경 없음 (빈 줄은 클리닝 대상 아님)
        String text = "내용1\n\n내용2\n\n내용3\n\n내용4";

        String result = pdfProcessingWorker.removeRepeatingHeaders(text);

        assertTrue(result.contains("내용1"));
        assertTrue(result.contains("내용4"));
    }

    // --- removePageNumbers ---

    @Test
    void removePageNumbers_removesVariousPatterns() {
        // T4: 다양한 페이지 번호 패턴 제거
        String text = "본문 시작\n66\n다음 본문\n66 of 72\n더 많은 본문\n- 3 -\nPage 42\np. 15\n마지막 본문";

        String result = pdfProcessingWorker.removePageNumbers(text);

        assertTrue(result.contains("본문 시작"), "본문 유지");
        assertTrue(result.contains("다음 본문"), "본문 유지");
        assertTrue(result.contains("마지막 본문"), "본문 유지");
        assertFalse(result.matches("(?s).*^\\s*66\\s*$.*"), "단독 숫자 제거");
        assertFalse(result.contains("66 of 72"), "N of M 패턴 제거");
        assertFalse(result.contains("- 3 -"), "대시 패턴 제거");
        assertFalse(result.contains("Page 42"), "Page N 패턴 제거");
        assertFalse(result.contains("p. 15"), "p. N 패턴 제거");
    }

    @Test
    void removePageNumbers_preservesInlineNumbers() {
        // T5: 본문 내 숫자는 건드리지 않음
        String text = "테스트 결과는 66건이다.\n총 72개 항목 중 66개 통과.";

        String result = pdfProcessingWorker.removePageNumbers(text);

        assertEquals(text, result, "본문 내 숫자는 변경되지 않아야 함");
    }

    // --- normalizeWhitespace ---

    @Test
    void normalizeWhitespace_collapsesExcessiveBlankLines() {
        // T6: 연속 빈 줄 축소
        String text = "라인1\n\n\n\n\n라인2";

        String result = pdfProcessingWorker.normalizeWhitespace(text);

        // 3줄 이상 연속 빈 줄 → 2줄로 축소 (2 blank lines = 3 newlines between content)
        assertFalse(result.contains("\n\n\n\n"), "3줄 이상 연속 빈 줄이 남아있으면 안 됨");
        assertTrue(result.contains("라인1"));
        assertTrue(result.contains("라인2"));
    }

    @Test
    void normalizeWhitespace_trimsAndNormalizesSpaces() {
        // T7: 공백/탭 정규화
        String text = "  앞뒤 공백  \n\t탭문자\n여러   공백   있음";

        String result = pdfProcessingWorker.normalizeWhitespace(text);

        assertTrue(result.contains("앞뒤 공백"), "앞뒤 공백 trim");
        assertFalse(result.contains("\t"), "탭 → 공백 변환");
        assertTrue(result.contains("여러 공백 있음"), "연속 공백 → 단일 공백");
    }

    @Test
    void normalizeWhitespace_noChangeForCleanText() {
        String text = "정상\n텍스트";

        String result = pdfProcessingWorker.normalizeWhitespace(text);

        assertEquals(text, result);
    }

    // --- cleanExtractedText (integration) ---

    @Test
    void cleanExtractedText_appliesAllStepsSequentially() {
        // T10: 통합 클리닝 검증 — 헤더 제거 + 페이지 번호 제거 + 공백 정규화
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append("Repeated Header Line\n");
            sb.append("본문 내용 ").append(i).append("\n");
            sb.append(i + 1).append("\n");          // page number
            sb.append("\n\n\n\n");                  // excessive blank lines
        }

        String result = pdfProcessingWorker.cleanExtractedText(sb.toString());

        assertFalse(result.contains("Repeated Header Line"), "반복 헤더 제거됨");
        assertTrue(result.contains("본문 내용 0"), "본문 유지됨");
        assertFalse(result.contains("\n\n\n"), "연속 빈 줄 정규화됨");
    }

    // --- parseSections ---

    @Test
    void parseSections_detectsChapterHeaders() {
        String text = "서론 내용입니다.\n제1장 경계값 분석\n경계값에 대한 설명.\n제2장 동등 분할\n동등 분할 설명.";

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        assertTrue(sections.size() >= 2);
        boolean hasChapter1 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("제1장"));
        assertTrue(hasChapter1);
    }

    @Test
    void parseSections_fallbackWhenNoHeaders() {
        String text = "This is plain text without any chapter headers. Just regular content.";

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        assertEquals(1, sections.size());
        assertNull(sections.getFirst().name());
    }

    @Test
    void parseSections_doesNotSplitOnNumberedLists() {
        // T1: "1. 테스팅은..." 같은 번호 리스트가 섹션 구분되지 않아야 함
        String text = """
                제1장 테스팅의 원리
                테스팅의 7원칙:
                1. 테스팅은 결함의 존재를 밝히는 활동이지 결함이 없음을 증명하는 활동이 아니다.
                2. 완벽한 테스팅은 불가능하다.
                3. 조기 테스팅으로 시간과 비용을 절약할 수 있다.
                4. 결함은 집중된다.
                5. 살충제 패러독스에 유의한다.
                6. 테스팅은 정황에 의존적이다.
                7. 오류 부재의 궤변에 유의한다.
                """;

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        // "1. 테스팅은..." 등이 별도 섹션으로 분리되면 안 됨
        // 제1장 하나 + 앞부분(없으면) = 최대 1~2개
        assertTrue(sections.size() <= 2,
                "번호 리스트가 섹션으로 분리됨: " + sections.size() + "개 섹션 생성");

        // 7원칙 전체가 하나의 섹션에 포함되어야 함
        boolean found = sections.stream()
                .anyMatch(s -> s.content().contains("1. 테스팅은") && s.content().contains("7. 오류 부재"));
        assertTrue(found, "7원칙이 하나의 섹션에 포함되어야 함");
    }

    @Test
    void parseSections_recognizesOnlyChapterPatterns() {
        // T2: "제N장", "Chapter N"은 인식하지만 "1. 대문자"는 미인식
        String text = """
                제1장 테스팅의 기초
                기초에 대한 긴 설명이 여기에 들어갑니다. 이 설명은 충분히 길어야 합니다.
                Chapter 2 Advanced Testing
                Advanced content goes here with enough text to be meaningful.
                1. Introduction to Methods
                This should NOT be treated as a separate section.
                """;

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        boolean hasChapter1 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("제1장"));
        boolean hasChapter2 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("Chapter 2"));
        boolean hasNumberedItem = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().startsWith("1. Introduction"));

        assertTrue(hasChapter1, "제1장 인식 실패");
        assertTrue(hasChapter2, "Chapter 2 인식 실패");
        assertFalse(hasNumberedItem, "번호 리스트 '1. Introduction'이 섹션으로 오인식됨");
    }

    @Test
    void parseSections_recognizesMultiLevelNumbering() {
        // T8: "6.1 제목" → 섹션으로 인식
        String text = """
                제1장 테스팅의 기초
                기초에 대한 설명입니다.
                6.1 테스팅 지원 도구
                지원 도구에 대한 설명입니다.
                6.2. 테스트 자동화
                자동화에 대한 설명입니다.
                Section 3 Advanced Topics
                고급 주제에 대한 설명입니다.
                """;

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        boolean has6_1 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("6.1"));
        boolean has6_2 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("6.2"));
        boolean hasSection3 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("Section 3"));

        assertTrue(has6_1, "6.1 다단계 넘버링 인식 실패");
        assertTrue(has6_2, "6.2. 다단계 넘버링 인식 실패");
        assertTrue(hasSection3, "Section 3 인식 실패");
    }

    @Test
    void parseSections_multiLevelDoesNotSplitLowercaseLists() {
        // T9: "1. lowercase..." 는 섹션으로 미인식
        String text = """
                제1장 테스팅의 원리
                다음은 중요한 원칙입니다:
                1. testing is important for quality.
                2. complete testing is impossible.
                3. early testing saves time.
                """;

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        boolean hasLowercaseSection = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().startsWith("1. testing"));
        assertFalse(hasLowercaseSection, "소문자 시작 번호 리스트가 섹션으로 오인식됨");
    }

    @Test
    void parseSections_detectsEnglishChapterPattern() {
        String text = "Chapter 1 Introduction\nSome content here.\nChapter 2 Methods\nMore content.";

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(text);

        assertTrue(sections.size() >= 2);
        boolean hasChapter1 = sections.stream()
                .anyMatch(s -> s.name() != null && s.name().contains("Chapter 1"));
        assertTrue(hasChapter1, "Should detect 'Chapter 1' pattern");
    }

    // --- mergeSections ---

    @Test
    void mergeSections_mergesSmallSectionIntoNext() {
        // T3: 200자 미만 섹션이 인접 섹션에 병합됨
        List<PdfProcessingWorker.Section> sections = new ArrayList<>();
        sections.add(new PdfProcessingWorker.Section("목차", "짧은 목차 내용"));  // < 200자
        sections.add(new PdfProcessingWorker.Section("제1장 본문",
                "a".repeat(300)));  // >= 200자

        List<PdfProcessingWorker.Section> merged = pdfProcessingWorker.mergeSections(sections);

        assertEquals(1, merged.size(), "소형 섹션이 병합되어 1개만 남아야 함");
        assertTrue(merged.getFirst().content().contains("짧은 목차 내용"),
                "소형 섹션 내용이 병합된 섹션에 포함되어야 함");
    }

    @Test
    void mergeSections_preservesLargeSections() {
        // T4: 모든 섹션이 200자 이상이면 변경 없음
        List<PdfProcessingWorker.Section> sections = new ArrayList<>();
        sections.add(new PdfProcessingWorker.Section("제1장", "a".repeat(300)));
        sections.add(new PdfProcessingWorker.Section("제2장", "b".repeat(400)));
        sections.add(new PdfProcessingWorker.Section("제3장", "c".repeat(250)));

        List<PdfProcessingWorker.Section> merged = pdfProcessingWorker.mergeSections(sections);

        assertEquals(3, merged.size(), "모든 섹션이 200자 이상이므로 변경 없어야 함");
    }

    @Test
    void mergeSections_mergesConsecutiveSmallSections() {
        List<PdfProcessingWorker.Section> sections = new ArrayList<>();
        sections.add(new PdfProcessingWorker.Section("소형1", "짧음"));
        sections.add(new PdfProcessingWorker.Section("소형2", "역시 짧음"));
        sections.add(new PdfProcessingWorker.Section("대형", "a".repeat(300)));

        List<PdfProcessingWorker.Section> merged = pdfProcessingWorker.mergeSections(sections);

        assertTrue(merged.size() <= 2, "소형 섹션들이 병합되어야 함");
    }

    // --- chunkText ---

    @Test
    void chunkText_splitsLongTextIntoChunks() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 300; i++) {
            sb.append("This is sentence number ").append(i).append(". ");
        }

        List<String> chunks = pdfProcessingWorker.chunkText(sb.toString());

        assertTrue(chunks.size() >= 2, "Expected at least 2 chunks for ~1500 words");
        for (String chunk : chunks) {
            assertFalse(chunk.isBlank());
        }
    }

    @Test
    void chunkText_returnsShortTextAsSingleChunk() {
        String text = "Short text that is well under the minimum chunk size.";

        List<String> chunks = pdfProcessingWorker.chunkText(text);

        assertEquals(1, chunks.size());
    }

    @Test
    void chunkText_emptyText_returnsSingleEmptyChunk() {
        List<String> chunks = pdfProcessingWorker.chunkText("");

        assertTrue(chunks.size() <= 1);
    }

    // --- enforceMaxSize ---

    @Test
    void enforceMaxSize_splitsOversizedChunk() {
        // T5: 3,000자 초과 청크가 강제 분할됨
        String oversized = "word ".repeat(1000);  // ~5,000자
        List<String> chunks = List.of(oversized);

        List<String> result = pdfProcessingWorker.enforceMaxSize(chunks);

        assertTrue(result.size() >= 2, "3,000자 초과 청크가 분할되어야 함");
        for (String chunk : result) {
            assertTrue(chunk.length() <= 3100,
                    "분할된 청크가 3,000자를 크게 초과함: " + chunk.length() + "자");
        }
    }

    @Test
    void enforceMaxSize_preservesNormalChunks() {
        List<String> chunks = List.of("normal chunk", "another normal chunk");

        List<String> result = pdfProcessingWorker.enforceMaxSize(chunks);

        assertEquals(2, result.size(), "정상 크기 청크는 변경되지 않아야 함");
    }

    // --- Full pipeline ---

    @Test
    void parseSections_thenChunkText_fullPipeline() {
        StringBuilder sb = new StringBuilder();
        sb.append("Introduction to QA methodology.\n\n");
        sb.append("Chapter 1 Unit Testing Fundamentals\n");
        for (int i = 0; i < 200; i++) {
            sb.append("Unit testing verifies individual components in isolation. ");
        }
        sb.append("\nChapter 2 Integration Testing Strategies\n");
        for (int i = 0; i < 200; i++) {
            sb.append("Integration testing validates interactions between components. ");
        }

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(sb.toString());
        sections = pdfProcessingWorker.mergeSections(sections);

        int totalChunks = 0;
        for (PdfProcessingWorker.Section section : sections) {
            List<String> chunks = pdfProcessingWorker.chunkText(section.content());
            chunks = pdfProcessingWorker.enforceMaxSize(chunks);
            totalChunks += chunks.size();
        }

        assertTrue(sections.size() >= 2, "Should detect at least 2 chapters");
        assertTrue(totalChunks >= 2, "Large sections should produce multiple chunks");
    }

    @Test
    void fullPipeline_globalSequenceProducesUniqueNames() {
        // T6: 전체 파이프라인에서 청크 이름이 모두 고유해야 함
        StringBuilder sb = new StringBuilder();
        sb.append("제1장 테스팅의 기초\n");
        sb.append("a]".repeat(100)).append("\n");
        sb.append("제2장 개발수명주기\n");
        sb.append("b ".repeat(100)).append("\n");
        sb.append("제3장 정적 테스팅\n");
        sb.append("c ".repeat(100)).append("\n");

        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(sb.toString());
        sections = pdfProcessingWorker.mergeSections(sections);

        Set<String> titles = new HashSet<>();
        int globalSeq = 1;
        for (PdfProcessingWorker.Section section : sections) {
            List<String> chunks = pdfProcessingWorker.chunkText(section.content());
            chunks = pdfProcessingWorker.enforceMaxSize(chunks);
            for (String chunk : chunks) {
                String title = "TestBook - " + (section.name() != null ? section.name() : "chunk")
                        + " - " + String.format("%03d", globalSeq++);
                assertFalse(titles.contains(title), "중복 이름 발견: " + title);
                titles.add(title);
            }
        }
        assertTrue(titles.size() > 0, "청크가 1개 이상 생성되어야 함");
    }
}
