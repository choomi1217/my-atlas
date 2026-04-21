package com.myqaweb.knowledgebase;

import com.myqaweb.common.BaseIntegrationTest;
import com.myqaweb.monitoring.AiUsageLogEntity;
import com.myqaweb.monitoring.AiUsageLogRepository;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

    @Autowired
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Autowired
    private AiUsageLogRepository aiUsageLogRepository;

    @MockBean
    private ChatClient chatClient;

    // Cleanup JSON response: 2 chunks, one meaningful, one not-meaningful (filtered out).
    private static final String REFINED_CHUNKS_JSON = """
            [
              {
                "title": "테스트 설계 기법 — 동등 분할",
                "markdown": "## 동등 분할\\n\\n**동등 분할(Equivalence Partitioning)**은 입력 데이터를 동일한 방식으로 처리되는 그룹으로 나누어 각 그룹에서 하나의 대표 값만 테스트하는 기법이다. 이는 전체 입력 공간을 효율적으로 커버하면서도 테스트 케이스 수를 줄여준다.\\n\\n- 유효 분할과 무효 분할을 구분한다\\n- 각 분할에서 최소 하나의 테스트 케이스를 설계한다\\n- 경계값 분석과 함께 사용하면 효과적이다",
                "meaningful": true,
                "reason": "QA 테스트 설계 기법 설명"
              },
              {
                "title": "페이지 번호 조각",
                "markdown": "123",
                "meaningful": false,
                "reason": "페이지 번호 잔해"
              }
            ]
            """;

    @BeforeEach
    void setUp() {
        jobRepository.deleteAll();
        knowledgeBaseRepository.deleteAll();
        aiUsageLogRepository.deleteAll();

        // Mock embedding (fast, no API call)
        float[] zeros = new float[1536];
        when(embeddingService.embed(anyString(), any())).thenReturn(zeros);
        when(embeddingService.toVectorString(any(float[].class)))
                .thenReturn("[" + "0,".repeat(1535) + "0]");

        // Mock Haiku — returns refined JSON for every section
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec =
                mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        Generation generation = new Generation(REFINED_CHUNKS_JSON);
        Usage usage = mock(Usage.class);
        lenient().when(usage.getPromptTokens()).thenReturn(500L);
        lenient().when(usage.getGenerationTokens()).thenReturn(300L);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        lenient().when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        lenient().when(chatClient.prompt()).thenReturn(clientRequest);
        lenient().when(clientRequest.user(anyString())).thenReturn(clientRequest);
        lenient().when(clientRequest.options(any(org.springframework.ai.chat.prompt.ChatOptions.class)))
                .thenReturn(clientRequest);
        lenient().when(clientRequest.call()).thenReturn(callSpec);
        lenient().when(callSpec.chatResponse()).thenReturn(chatResponse);
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

    @Test
    void processPdf_withCleanup_savesRefinedChunksAndLogsAiUsage() throws IOException {
        // Arrange — create a PENDING job + load a small test PDF.
        // minimal.pdf is used so that the mock Haiku response (~370 chars) passes the
        // 70% recall check in KbContentCleanupService. A larger PDF (qa-handbook) would
        // need a per-section mock sized to each input, which is brittle.
        byte[] pdfBytes = new ClassPathResource("test-pdfs/minimal.pdf").getContentAsByteArray();

        PdfUploadJobEntity job = new PdfUploadJobEntity();
        job.setBookTitle("QA Handbook");
        job.setOriginalFilename("minimal.pdf");
        job.setStatus("PENDING");
        PdfUploadJobEntity saved = jobRepository.save(job);
        Long jobId = saved.getId();

        // Act — trigger @Async processing
        pdfProcessingWorker.processPdf(jobId, pdfBytes, "QA Handbook", "테스팅");

        // Assert — wait for DONE
        Awaitility.await()
                .atMost(Duration.ofSeconds(30))
                .pollInterval(Duration.ofMillis(500))
                .untilAsserted(() -> {
                    PdfUploadJobEntity j = jobRepository.findById(jobId).orElseThrow();
                    assertEquals("DONE", j.getStatus(),
                            "Job should reach DONE (error=" + j.getErrorMessage() + ")");
                });

        PdfUploadJobEntity finalJob = jobRepository.findById(jobId).orElseThrow();
        assertEquals("DONE", finalJob.getStatus());
        assertNotNull(finalJob.getTotalChunks());
        assertTrue(finalJob.getTotalChunks() > 0,
                "At least one refined chunk should be saved (2 chunks × N sections, filtered to meaningful=true)");

        // Refined KB entries: only "meaningful=true" chunks saved, Markdown preserved
        List<KnowledgeBaseEntity> saved_kbs = knowledgeBaseRepository.findAll();
        assertFalse(saved_kbs.isEmpty(), "KB should contain refined chunks");
        for (KnowledgeBaseEntity kb : saved_kbs) {
            assertEquals("QA Handbook", kb.getSource());
            assertTrue(kb.getContent().contains("**") || kb.getContent().contains("## "),
                    "Saved content should be Markdown (contains ** or ##)");
            assertFalse(kb.getTitle().contains("페이지 번호 조각"),
                    "meaningful=false chunks must not be saved");
        }

        // AI usage log: PDF_CLEANUP entries per section call
        List<AiUsageLogEntity> logs = aiUsageLogRepository.findAll();
        assertFalse(logs.isEmpty(), "ai_usage_log should have entries");
        long cleanupEntries = logs.stream()
                .filter(l -> "PDF_CLEANUP".equals(l.getFeature()))
                .count();
        assertTrue(cleanupEntries > 0, "Expected at least one PDF_CLEANUP log entry");
        AiUsageLogEntity firstCleanup = logs.stream()
                .filter(l -> "PDF_CLEANUP".equals(l.getFeature()))
                .findFirst()
                .orElseThrow();
        assertEquals("ANTHROPIC", firstCleanup.getProvider());
        assertEquals("claude-haiku-4-5-20251001", firstCleanup.getModel());
        assertTrue(firstCleanup.getSuccess(), "Mocked cleanup should succeed");
    }

    private String extractTextFromPdf(byte[] pdfBytes) throws IOException {
        try (var document = org.apache.pdfbox.Loader.loadPDF(pdfBytes)) {
            return new org.apache.pdfbox.text.PDFTextStripper().getText(document);
        }
    }
}
