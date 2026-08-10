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
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import com.myqaweb.monitoring.AiUsageLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

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

    @Mock
    private AiUsageLogService aiUsageLogService;

    @Mock
    private TestStudioStyleService styleService;

    private TestStudioGenerator generator;

    private TestStudioJobEntity job;
    private ProductEntity product;

    private static final String VALID_JSON = """
            [
              {
                "title": "[Card] NFC 정상 결제",
                "preconditions": "단말기 정상 연결",
                "steps": [{"order": 1, "action": "NFC 태그", "expected": "승인"}],
                "expectedResults": ["결제 완료"],
                "priority": "HIGH",
                "testType": "FUNCTIONAL",
                "suggestedSegmentPath": ["결제", "NFC"]
              },
              {
                "title": "[Card] NFC 타임아웃",
                "preconditions": "단말기 정상 연결",
                "steps": [{"order": 1, "action": "NFC 태그 없이 대기", "expected": "타임아웃"}],
                "expectedResults": ["오류 메시지"],
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
                aiUsageLogService,
                kbRepository,
                conventionRepository,
                testCaseRepository,
                productRepository,
                embeddingService,
                chatClient,
                new ObjectMapper(),
                styleService
        );

        CompanyEntity company = new CompanyEntity(1L, "Acme", true, LocalDateTime.now());
        product = new ProductEntity(
                10L, company, "Payment App", Platform.MOBILE,
                "Payment product", null, null, null, LocalDateTime.now()
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

    /**
     * Wires the fluent ChatClient mock to return {@code content}.
     *
     * @return the request-spec mock, so callers can capture the user prompt via
     *         {@code verify(spec).user(captor.capture())}.
     */
    private ChatClient.ChatClientRequestSpec stubChatClientContent(String content) {
        ChatClient.ChatClientRequestSpec clientRequest = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec callSpec =
                mock(ChatClient.CallResponseSpec.class);

        Generation generation = new Generation(new AssistantMessage(content));
        Usage usage = mock(Usage.class);
        lenient().when(usage.getPromptTokens()).thenReturn(100);
        lenient().when(usage.getCompletionTokens()).thenReturn(50);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        lenient().when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.options(any(org.springframework.ai.chat.prompt.ChatOptions.Builder.class)))
                .thenReturn(clientRequest);
        when(clientRequest.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(chatResponse);
        return clientRequest;
    }

    private void stubBaseRag() {
        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f, 0.2f, 0.3f});
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

        // v2.5: team style comes from the style service (Company-scoped). companyId = product.company = 1L.
        when(styleService.resolveActiveExamples(1L)).thenReturn(DefaultStyleSamples.samples());
        when(styleService.getConfig(1L)).thenReturn(new TestStudioConfigDto.ConfigResponse(
                1L, null, StepFormat.ACTION_EXPECTED, DetailLevel.STANDARD, Tone.PLAIN));
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
        assertEquals(0, first.getPath().length, "v2 path stays empty — no automatic injection");
        assertEquals(1, first.getSteps().size());
        assertEquals(product, first.getProduct());

        // v2: suggestedSegmentPath must be persisted from the draft for later user-triggered apply.
        assertArrayEquals(new String[]{"결제", "NFC"}, first.getSuggestedSegmentPath(),
                "Draft suggestedSegmentPath should be copied into entity as String[]");
        TestCaseEntity second = persisted.get(1);
        assertArrayEquals(new String[]{"결제", "NFC"}, second.getSuggestedSegmentPath());

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
                   "expectedResults":["결제 완료"],"priority":"HIGH","testType":"FUNCTIONAL",\
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
        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(kbRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());
        when(styleService.resolveActiveExamples(1L)).thenReturn(DefaultStyleSamples.samples());
        when(styleService.getConfig(1L)).thenReturn(new TestStudioConfigDto.ConfigResponse(
                1L, null, StepFormat.ACTION_EXPECTED, DetailLevel.STANDARD, Tone.PLAIN));

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

    // --- Context construction (KB + Convention + team style) ---

    @Test
    void generate_buildsContext_fromKbConventionAndStyleService() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        stubChatClientContent(VALID_JSON);

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        // Verify context reads
        ArgumentCaptor<Integer> topKCaptor = ArgumentCaptor.forClass(Integer.class);
        verify(kbRepository).findSimilar(anyString(), topKCaptor.capture());
        assertEquals(5, topKCaptor.getValue(), "KB topK should be 5");
        verify(conventionRepository).findAll();
        // v2.5: team style comes from the style service (Company-scoped), NOT from existing TCs.
        verify(styleService).resolveActiveExamples(1L);
        verify(styleService).getConfig(1L);
        verify(testCaseRepository, never()).findAllByProductIdAndStatus(any(), any());
        verify(testCaseRepository, never()).findAllByProductId(any());
        verify(embeddingService).embed(anyString(), any());
    }

    // --- v3 Phase 0: product.description injected into prompt ---

    @Test
    void generate_promptIncludesProductNameAndDescription() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag();
        ChatClient.ChatClientRequestSpec req = stubChatClientContent(VALID_JSON);

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(req).user(promptCaptor.capture());
        String prompt = promptCaptor.getValue();

        assertTrue(prompt.contains("Payment App"), "prompt should contain product name");
        assertTrue(prompt.contains("설명: Payment product"),
                "prompt should contain product.description under the [Product] block");
    }

    @Test
    void generate_whenProductDescriptionBlank_promptOmitsDescriptionLine() {
        CompanyEntity company = new CompanyEntity(1L, "Acme", true, LocalDateTime.now());
        ProductEntity noDescProduct = new ProductEntity(
                10L, company, "Payment App", Platform.MOBILE,
                null, null, LocalDateTime.now()
        );
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(noDescProduct));
        stubBaseRag();
        ChatClient.ChatClientRequestSpec req = stubChatClientContent(VALID_JSON);

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(req).user(promptCaptor.capture());
        String prompt = promptCaptor.getValue();

        assertTrue(prompt.contains("Payment App"), "prompt should still contain product name");
        assertFalse(prompt.contains("설명:"),
                "prompt should omit the 설명: line when description is null/blank");
    }

    // --- v2.5: style examples injected verbatim + content-ignore instruction + aux guide ---

    @Test
    void generate_promptIncludesStyleExamplesVerbatim_andContentIgnoreInstruction() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(kbRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());

        // A user-authored style example set (verbatim) — must appear as-is in the prompt.
        TestStudioStyleExampleDto.ExampleResponse example = new TestStudioStyleExampleDto.ExampleResponse(
                1L, 7L, "[결제] IC카드 승인 실패 처리", "단말기 연결됨",
                List.of(new TestStep(1, "만료 카드를 삽입한다", "거절 메시지가 표시된다")),
                List.of("승인이 거절된다"), Priority.HIGH, TestType.FUNCTIONAL, 0, null, null);
        when(styleService.resolveActiveExamples(1L)).thenReturn(List.of(example));
        when(styleService.getConfig(1L)).thenReturn(new TestStudioConfigDto.ConfigResponse(
                1L, 7L, StepFormat.GIVEN_WHEN_THEN, DetailLevel.DETAILED, Tone.FORMAL));

        ChatClient.ChatClientRequestSpec req = stubChatClientContent(VALID_JSON);
        generator.generate(100L, 10L, SourceType.MARKDOWN, "결제 스펙 문서", null);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(req).user(promptCaptor.capture());
        String prompt = promptCaptor.getValue();

        // Style example rendered verbatim (title + step text).
        assertTrue(prompt.contains("[결제] IC카드 승인 실패 처리"),
                "style example title should be rendered verbatim");
        assertTrue(prompt.contains("만료 카드를 삽입한다 → 거절 메시지가 표시된다"),
                "style example step should be rendered verbatim");
        // Content-ignore instruction present.
        assertTrue(prompt.contains("예시의 내용(로그인 등)은 무시"),
                "prompt must instruct the model to ignore example content and follow only its form");
        // Aux guide reflects config enums.
        assertTrue(prompt.contains("Given / When / Then 구조로"), "step-format hint should reflect config");
        assertTrue(prompt.contains("격식체(합니다)"), "tone hint should reflect config");
    }

    @Test
    void generate_whenNoStyleSet_fallsBackToLoginSampleInPrompt() {
        when(jobRepository.findById(100L)).thenReturn(Optional.of(job));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
        stubBaseRag(); // resolveActiveExamples(1L) → DefaultStyleSamples (login Sample)
        ChatClient.ChatClientRequestSpec req = stubChatClientContent(VALID_JSON);

        generator.generate(100L, 10L, SourceType.MARKDOWN, "# Spec", null);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(req).user(promptCaptor.capture());
        String prompt = promptCaptor.getValue();

        assertTrue(prompt.contains("[로그인]"),
                "with no selected set, the built-in login Sample should appear as the style example");
    }
}
