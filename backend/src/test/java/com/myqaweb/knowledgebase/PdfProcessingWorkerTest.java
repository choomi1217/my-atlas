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
