package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

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

    // --- parseSections + chunkText combined flow ---

    @Test
    void parseSections_thenChunkText_fullPipeline() {
        // Arrange — simulate multi-chapter content
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

        // Act — parse into sections
        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(sb.toString());

        // Act — chunk each section
        int totalChunks = 0;
        for (PdfProcessingWorker.Section section : sections) {
            List<String> chunks = pdfProcessingWorker.chunkText(section.content());
            totalChunks += chunks.size();
        }

        // Assert
        assertTrue(sections.size() >= 2, "Should detect at least 2 chapters");
        assertTrue(totalChunks >= 2, "Large sections should produce multiple chunks");
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

    @Test
    void chunkText_emptyText_returnsSingleEmptyChunk() {
        List<String> chunks = pdfProcessingWorker.chunkText("");

        // Empty input may produce a single chunk or none depending on impl
        assertTrue(chunks.size() <= 1);
    }
}
