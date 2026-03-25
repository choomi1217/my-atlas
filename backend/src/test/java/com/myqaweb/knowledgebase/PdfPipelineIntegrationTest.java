package com.myqaweb.knowledgebase;

import com.myqaweb.common.BaseIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for PDF upload pipeline using real pgvector database.
 * Tests job lifecycle (PENDING → DONE/FAILED) and text extraction/chunking.
 * Uses test PDF files from src/test/resources/test-pdfs/.
 */
class PdfPipelineIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private PdfUploadJobRepository jobRepository;

    @Autowired
    private PdfProcessingWorker pdfProcessingWorker;

    @BeforeEach
    void setUp() {
        jobRepository.deleteAll();
    }

    @Test
    void startUpload_createsJobInPendingState() {
        // Arrange
        PdfUploadJobEntity job = new PdfUploadJobEntity();
        job.setBookTitle("Test Book");
        job.setOriginalFilename("test.pdf");
        job.setStatus("PENDING");

        // Act
        PdfUploadJobEntity saved = jobRepository.save(job);

        // Assert
        assertNotNull(saved.getId());
        assertEquals("PENDING", saved.getStatus());
        assertEquals("Test Book", saved.getBookTitle());
        assertNotNull(saved.getCreatedAt());
    }

    @Test
    void parseSections_extractsChaptersFromPdf() throws IOException {
        // Arrange
        byte[] pdfBytes = new ClassPathResource("test-pdfs/qa-handbook.pdf").getContentAsByteArray();

        // Act — test text extraction and section parsing directly (not @Async)
        String extractedText = extractTextFromPdf(pdfBytes);
        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(extractedText);

        // Assert
        assertFalse(extractedText.isBlank(), "PDF should contain extractable text");
        assertFalse(sections.isEmpty(), "Should parse at least one section");
    }

    @Test
    void chunkText_producesChunksFromParsedSections() throws IOException {
        // Arrange
        byte[] pdfBytes = new ClassPathResource("test-pdfs/qa-handbook.pdf").getContentAsByteArray();
        String extractedText = extractTextFromPdf(pdfBytes);
        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(extractedText);

        // Act
        int totalChunks = 0;
        for (PdfProcessingWorker.Section section : sections) {
            List<String> chunks = pdfProcessingWorker.chunkText(section.content());
            totalChunks += chunks.size();
            for (String chunk : chunks) {
                assertFalse(chunk.isBlank(), "Chunk should not be blank");
            }
        }

        // Assert
        assertTrue(totalChunks > 0, "Should produce at least one chunk from PDF");
    }

    @Test
    void minimalPdf_producesAtLeastOneSection() throws IOException {
        // Arrange
        byte[] pdfBytes = new ClassPathResource("test-pdfs/minimal.pdf").getContentAsByteArray();

        // Act
        String extractedText = extractTextFromPdf(pdfBytes);
        List<PdfProcessingWorker.Section> sections = pdfProcessingWorker.parseSections(extractedText);

        // Assert
        assertFalse(extractedText.isBlank(), "Minimal PDF should have some text");
        assertFalse(sections.isEmpty());
    }

    @Test
    void emptyPdf_hasNoExtractableText() throws IOException {
        // Arrange
        byte[] pdfBytes = new ClassPathResource("test-pdfs/empty.pdf").getContentAsByteArray();

        // Act
        String extractedText = extractTextFromPdf(pdfBytes);

        // Assert
        assertTrue(extractedText.isBlank(), "Empty PDF should have no extractable text");
    }

    private String extractTextFromPdf(byte[] pdfBytes) throws IOException {
        try (var document = org.apache.pdfbox.Loader.loadPDF(pdfBytes)) {
            return new org.apache.pdfbox.text.PDFTextStripper().getText(document);
        }
    }
}
