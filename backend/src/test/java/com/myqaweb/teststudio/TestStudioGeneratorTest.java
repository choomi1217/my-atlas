package com.myqaweb.teststudio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.EmbeddingService;
import com.myqaweb.convention.ConventionEntity;
import com.myqaweb.convention.ConventionRepository;
import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.Platform;
import com.myqaweb.feature.Priority;
import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.ProductRepository;
import com.myqaweb.feature.TestCaseEntity;
import com.myqaweb.feature.TestCaseRepository;
import com.myqaweb.feature.TestStatus;
import com.myqaweb.feature.TestType;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TestStudioGenerator}.
 *
 * <p>Covers the MARKDOWN generation pipeline — RAG context build, Claude call,
 * JSON parsing, DRAFT TC persistence, and job status transitions.
 *
 * <p>Note: PDF branch is intentionally not unit-tested here. PDFBox extraction is
 * exercised via {@link TestStudioIntegrationTest} and E2E tests — constructing
 * a minimal valid PDF byte[] in-memory would pull in PDFBox/Loader just to
 * validate the mocked path.
 */
@ExtendWith(MockitoExtension.class)
class TestStudioGeneratorTest {

    @Mock
    private TestStudioJobRepository jobRepository;

    @Mock
    private KnowledgeBaseRepository kbRepository;

    @Mock
    private ConventionRepository conventionRepository;

    @Mock
    private TestCaseRepository testCaseRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private EmbeddingService embeddingService;

    @Mock
    private ChatClient chatClient;

    private TestStudioGenerator generator;

    private TestStudioJobEntity job;
    private ProductEntity product;

    private static final String VALID_JSON = """
            [
              {
                "title": "[Card] NFC 정상 결제",
                "preconditions": "단말기 정상 연결",
                "steps": [{"order": 1, "action": "NFC 태그", "expected": "승인"}],
                "expectedResult": "결제 완료",
                "priority": "HIGH",
                "testType": "FUNCTIONAL",
                "suggestedSegmentPath": ["결제", "NFC"]
              },
              {
                "title": "[Card] NFC 타임아웃",
                "preconditions": "단말기 정상 연결",
                "steps": [{"order": 1, "action": "NFC 태그 없이 대기", "expected": "타임아웃"}],
                "expectedResult": "오류 메시지",
                "priority": "MEDIUM",
                "testType": "FUNCTIONAL",
                "suggestedSegmentPath": ["결제", "NFC"]
              }
            ]
            """;

    @BeforeEach
    void setUp() {
        generator = new TestStudioGenerator(
                jobRepository,
                kbRepository,
                conventionRepository,
                testCaseRepository,
                productRepository,
                embeddingService,
                chatClient,
                new ObjectMapper()
        );

        CompanyEntity company = new CompanyEntity(1L, "Acme", true, LocalDateTime.now());
        product = new ProductEntity(
                10L, company, "Payment App", Platform.MOBILE,
                "Payment product", null, LocalDateTime.now()
        );

        job = new TestStudioJobEntity();
        job.setId(100L);
        job.setProductId(10L);
        job.setSourceType(SourceType.MARKDOWN);
        job.setSourceTitle("Spec v1");
        job.setSourceContent("# Spec\n내용");
        job.setStatus(TestStudioJobStatus.PENDING);
        job.setGeneratedCount(0);
        job.setCreatedAt(LocalDateTime.now());
    }

    // --- Helpers to wire the fluent ChatClient mock ---

    private void stubChatClientContent(String content) {
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec =
                mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        // Production code overrides max-tokens per call via .options(AnthropicChatOptions).
        when(clientRequest.options(any(org.springframework.ai.chat.prompt.ChatOptions.class)))
                .thenReturn(clientRequest);
        when(clientRequest.call()).thenReturn(callSpec);
        when(callSpec.content()).thenReturn(content);
    }

    private void stubBaseRag() {
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f, 0.2f, 0.3f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1,0.2,0.3]");

        KnowledgeBaseEntity kb = new KnowledgeBaseEntity();
        kb.setId(1L);
        kb.setTitle("KB Title");
        kb.setContent("KB Content for reference");
        when(kbRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of(kb));

        ConventionEntity conv = new ConventionEntity();
        conv.setId(1L);
        conv.setTerm("TC");
        conv.setDefinition("Test Case");
        when(conventionRepository.findAll()).thenReturn(List.of(conv));

        TestCaseEntity existingTc = new TestCaseEntity();
        existingTc.setId(1L);
        existingTc.setProduct(product);
        existingTc.setTitle("Existing TC");
        existingTc.setSteps(List.of());
        existingTc.setExpectedResult("ok");
        existingTc.setPath(new Long[0]);
        existingTc.setPriority(Priority.MEDIUM);
        existingTc.setTestType(TestType.FUNCTIONAL);
        existingTc.setStatus(TestStatus.ACTIVE);
        when(testCaseRepository.findAllByProductId(10L)).thenReturn(List.of(existingTc));
    }

    // --- Happy path ---

    @Test
    void generate_markdown_happyPath_persistsDraftsAndMarksDone() {
        // Arrange
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        stubChatClientContent(VALID_JSON);

        // Snapshot job status at save-time: the generator mutates `job` in place across
        // PROCESSING → DONE, so ArgumentCaptor sees only the final state for both refs.
        List<TestStudioJobStatus> jobStatusSnapshots = new ArrayList<>();
        doAnswer(inv -> {
            TestStudioJobEntity arg = inv.getArgument(0);
            jobStatusSnapshots.add(arg.getStatus());
            return arg;
        }).when(jobRepository).save(any(TestStudioJobEntity.class));

        // Act
        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec\n내용", null);

        // Assert — 2 TCs persisted
        ArgumentCaptor<TestCaseEntity> tcCaptor = ArgumentCaptor.forClass(TestCaseEntity.class);
        verify(testCaseRepository, times(2)).save(tcCaptor.capture());

        List<TestCaseEntity> persisted = tcCaptor.getAllValues();
        TestCaseEntity first = persisted.get(0);
        assertEquals("[Card] NFC 정상 결제", first.getTitle());
        assertEquals(TestStatus.DRAFT, first.getStatus());
        assertEquals(100L, first.getTestStudioJobId());
        assertEquals(Priority.HIGH, first.getPriority());
        assertEquals(TestType.FUNCTIONAL, first.getTestType());
        assertNotNull(first.getPath());
        assertEquals(0, first.getPath().length, "v1 path should be empty (user selects later)");
        assertEquals(1, first.getSteps().size());
        assertEquals(product, first.getProduct());

        // Assert — job transitioned PENDING → PROCESSING → DONE via 2 saves
        assertEquals(2, jobStatusSnapshots.size(), "expected exactly 2 save() invocations on job");
        assertEquals(TestStudioJobStatus.PROCESSING, jobStatusSnapshots.get(0));
        assertEquals(TestStudioJobStatus.DONE, jobStatusSnapshots.get(1));

        // Final state (reads directly from the shared fixture — it is the mutated ref)
        assertEquals(TestStudioJobStatus.DONE, job.getStatus());
        assertEquals(2, job.getGeneratedCount());
        assertNotNull(job.getCompletedAt());
        assertNull(job.getErrorMessage());
    }

    // --- Markdown fences stripping ---

    @Test
    void generate_markdown_withMarkdownFencesInResponse_stillParses() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        stubChatClientContent("```json\n" + VALID_JSON + "\n```");

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        verify(testCaseRepository, times(2)).save(any(TestCaseEntity.class));

        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository, times(2)).save(jobCaptor.capture());
        assertEquals(TestStudioJobStatus.DONE, jobCaptor.getAllValues().get(1).getStatus());
    }

    // --- Truncated JSON recovery (max_tokens hit mid-object) ---

    /**
     * Regression test for a real prod bug: Claude's response hit the max_tokens limit and the
     * JSON array was truncated mid-string. The parser must recover by trimming to the last
     * top-level complete object and still persist those as DRAFT TCs.
     */
    @Test
    void generate_markdown_truncatedJson_recoversPartialDrafts() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();

        // First object is complete; second was cut off mid-"title" before the closing quote.
        String truncated = """
                [
                  {"title":"[Card] NFC 정상 결제","preconditions":"단말기 정상 연결",\
                   "steps":[{"order":1,"action":"NFC 태그","expected":"승인"}],\
                   "expectedResult":"결제 완료","priority":"HIGH","testType":"FUNCTIONAL",\
                   "suggestedSegmentPath":["결제","NFC"]},
                  {"title":"[Card] NFC 타임아웃 케이스가 여기서 끝나지""";
        stubChatClientContent(truncated);

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        // The one complete object must be persisted.
        verify(testCaseRepository, times(1)).save(any(TestCaseEntity.class));

        // Job finishes as DONE (not FAILED) with generatedCount=1.
        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository, times(2)).save(jobCaptor.capture());
        TestStudioJobEntity finalState = jobCaptor.getAllValues().get(1);
        assertEquals(TestStudioJobStatus.DONE, finalState.getStatus());
        assertEquals(1, finalState.getGeneratedCount());
        assertNotNull(finalState.getCompletedAt());
    }

    // --- Invalid JSON → FAILED ---

    @Test
    void generate_markdown_invalidJson_marksFailed() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        stubChatClientContent("this is not json at all, absolutely garbage");

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        // No TC saved
        verify(testCaseRepository, never()).save(any(TestCaseEntity.class));

        // Final job state = FAILED with error message
        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository, times(2)).save(jobCaptor.capture());
        TestStudioJobEntity finalState = jobCaptor.getAllValues().get(1);
        assertEquals(TestStudioJobStatus.FAILED, finalState.getStatus());
        assertNotNull(finalState.getErrorMessage());
        assertNotNull(finalState.getCompletedAt());
    }

    // --- Empty array → FAILED ---

    @Test
    void generate_markdown_emptyArray_marksFailed() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        stubChatClientContent("[]");

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        verify(testCaseRepository, never()).save(any(TestCaseEntity.class));

        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository, times(2)).save(jobCaptor.capture());
        TestStudioJobEntity finalState = jobCaptor.getAllValues().get(1);
        assertEquals(TestStudioJobStatus.FAILED, finalState.getStatus());
        assertNotNull(finalState.getErrorMessage(),
                "Error message should be set when zero drafts produced");
    }

    // --- Exception handling ---

    @Test
    void generate_whenChatClientThrows_marksFailed() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));

        // Note: EmbeddingService exceptions are swallowed by buildKbContext(), so we
        // must trigger the failure at the ChatClient level to exercise the FAILED path.
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(kbRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());
        when(testCaseRepository.findAllByProductId(10L)).thenReturn(List.of());

        // Force an exception at the Claude call
        when(chatClient.prompt()).thenThrow(new RuntimeException("LLM unavailable"));

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        verify(testCaseRepository, never()).save(any(TestCaseEntity.class));
        ArgumentCaptor<TestStudioJobEntity> jobCaptor = ArgumentCaptor.forClass(TestStudioJobEntity.class);
        verify(jobRepository, times(2)).save(jobCaptor.capture());
        TestStudioJobEntity finalState = jobCaptor.getAllValues().get(1);
        assertEquals(TestStudioJobStatus.FAILED, finalState.getStatus());
        assertEquals("LLM unavailable", finalState.getErrorMessage());
    }

    // --- Missing job id → graceful no-op ---

    @Test
    void generate_whenJobMissing_returnsQuietly() {
        when(jobRepository.findById(999L)).thenReturn(Optional.empty());

        generator.generate(999L, 10L, SourceType.MARKDOWN, "# Spec", null);

        verify(jobRepository, never()).save(any());
        verifyNoInteractions(testCaseRepository, embeddingService);
    }

    // --- RAG context construction ---

    @Test
    void generate_buildsRagContext_fromKbConventionTcRepositories() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        stubChatClientContent(VALID_JSON);

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        // Verify RAG reads
        ArgumentCaptor<Integer> topKCaptor = ArgumentCaptor.forClass(Integer.class);
        verify(kbRepository).findSimilar(anyString(), topKCaptor.capture());
        assertEquals(5, topKCaptor.getValue(), "KB topK should be 5");
        verify(conventionRepository).findAll();
        verify(testCaseRepository).findAllByProductId(eq(10L));
        verify(embeddingService).embed(anyString());
    }
}
