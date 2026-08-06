package com.myqaweb.teststudio;

import com.myqaweb.common.BaseIntegrationTest;
import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.CompanyRepository;
import com.myqaweb.feature.Platform;
import com.myqaweb.feature.Priority;
import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.ProductRepository;
import com.myqaweb.feature.TestCaseRepository;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigRequest;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleRequest;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.CreateRequest;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.ProfileResponse;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Integration tests for Test Studio v2.5 Style-by-Example against a real pgvector DB.
 *
 * <p>Validates DB-specific behaviors not covered by mock-based unit tests:
 * <ul>
 *     <li>JSONB round-trip for example steps/expectedResults + exampleCount aggregation</li>
 *     <li>FK actions: deleting a profile CASCADEs its examples and SET NULLs config selection</li>
 *     <li>End-to-end: a selected style set's example is injected verbatim into the Claude prompt</li>
 * </ul>
 */
class TestStudioStyleIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private TestStudioStyleService styleService;
    @Autowired
    private TestStudioStyleProfileRepository profileRepository;
    @Autowired
    private TestStudioStyleExampleRepository exampleRepository;
    @Autowired
    private TestStudioConfigRepository configRepository;
    @Autowired
    private TestStudioService testStudioService;
    @Autowired
    private TestStudioJobRepository jobRepository;
    @Autowired
    private TestCaseRepository testCaseRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private CompanyRepository companyRepository;

    @MockitoBean
    private ChatClient chatClient;

    private ChatClient.ChatClientRequestSpec clientRequest;
    private Long companyId;
    private Long productId;

    private static final String VALID_RESPONSE = """
            [
              {
                "title": "[Gen] TC",
                "preconditions": "up",
                "steps": [{"order": 1, "action": "do", "expected": "ok"}],
                "expectedResults": ["works"],
                "priority": "HIGH",
                "testType": "FUNCTIONAL",
                "suggestedSegmentPath": ["X"]
              }
            ]
            """;

    @BeforeEach
    void setUp() {
        // Dependency order: config/examples reference profiles; profiles/config reference company.
        configRepository.deleteAll();
        exampleRepository.deleteAll();
        profileRepository.deleteAll();
        testCaseRepository.deleteAll();
        jobRepository.deleteAll();
        productRepository.deleteAll();
        companyRepository.deleteAll();

        CompanyEntity company = new CompanyEntity();
        company.setName("Style Corp");
        company.setIsActive(true);
        companyId = companyRepository.save(company).getId();

        ProductEntity product = new ProductEntity();
        product.setCompany(company);
        product.setName("Style Product");
        product.setPlatform(Platform.WEB);
        product.setDescription("style-it product");
        productId = productRepository.save(product).getId();

        float[] zeros = new float[1536];
        when(embeddingService.embed(anyString(), any())).thenReturn(zeros);
        when(embeddingService.toVectorString(any(float[].class)))
                .thenReturn("[" + "0,".repeat(1535) + "0]");

        clientRequest = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec callSpec = mock(ChatClient.CallResponseSpec.class);
        Generation generation = new Generation(new AssistantMessage(VALID_RESPONSE));
        Usage usage = mock(Usage.class);
        lenient().when(usage.getPromptTokens()).thenReturn(200);
        lenient().when(usage.getCompletionTokens()).thenReturn(100);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        lenient().when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.options(any(org.springframework.ai.chat.prompt.ChatOptions.Builder.class)))
                .thenReturn(clientRequest);
        when(clientRequest.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(chatResponse);
    }

    @Test
    void styleExampleCrud_persistsJsonbAndCounts() {
        ProfileResponse profile = styleService.createProfile(new CreateRequest(companyId, "결제팀 스타일"));

        styleService.addExample(profile.id(), new ExampleRequest(
                "[결제] IC카드 승인 실패", "단말기 연결됨",
                List.of(new TestStep(1, "만료 카드를 삽입한다", "거절 메시지가 표시된다"),
                        new TestStep(2, "확인을 누른다", "초기 화면으로 돌아간다")),
                List.of("승인이 거절된다", "재시도 안내가 표시된다"),
                Priority.HIGH, TestType.FUNCTIONAL, 0));

        // exampleCount reflected on the profile listing
        List<ProfileResponse> profiles = styleService.listProfiles(companyId);
        assertEquals(1, profiles.size());
        assertEquals(1L, profiles.get(0).exampleCount());

        // JSONB round-trip: steps + expectedResults survive the DB
        List<ExampleResponse> examples = styleService.listExamples(profile.id());
        assertEquals(1, examples.size());
        ExampleResponse ex = examples.get(0);
        assertEquals(2, ex.steps().size());
        assertEquals("만료 카드를 삽입한다", ex.steps().get(0).action());
        assertEquals(List.of("승인이 거절된다", "재시도 안내가 표시된다"), ex.expectedResults());
        assertEquals(Priority.HIGH, ex.priority());
    }

    @Test
    void deleteProfile_cascadesExamples_andNullsConfigSelection() {
        ProfileResponse profile = styleService.createProfile(new CreateRequest(companyId, "세트"));
        styleService.addExample(profile.id(), new ExampleRequest(
                "예시", null, List.of(new TestStep(1, "a", "b")), List.of("r"),
                null, null, 0));
        styleService.upsertConfig(new ConfigRequest(companyId, profile.id(), null, null, null));

        assertEquals(1, exampleRepository.count());
        assertEquals(profile.id(),
                configRepository.findByCompanyId(companyId).orElseThrow().getSelectedProfileId());

        styleService.deleteProfile(profile.id());

        // examples cascade-deleted, config selection reset to NULL (=Sample)
        assertEquals(0, exampleRepository.count());
        assertNull(configRepository.findByCompanyId(companyId).orElseThrow().getSelectedProfileId(),
                "config.selected_profile_id should be SET NULL after the profile is deleted");
    }

    @Test
    void resolveActiveExamples_selectedVsSampleFallback() {
        // No config yet → Sample fallback (login built-in)
        List<ExampleResponse> fallback = styleService.resolveActiveExamples(companyId);
        assertEquals(DefaultStyleSamples.samples().size(), fallback.size());
        assertTrue(fallback.get(0).title().contains("[로그인]"));

        // Select a profile with an example → that example wins
        ProfileResponse profile = styleService.createProfile(new CreateRequest(companyId, "세트"));
        styleService.addExample(profile.id(), new ExampleRequest(
                "[커스텀] 예시", null, List.of(new TestStep(1, "a", "b")), List.of("r"),
                null, null, 0));
        styleService.upsertConfig(new ConfigRequest(companyId, profile.id(), null, null, null));

        List<ExampleResponse> active = styleService.resolveActiveExamples(companyId);
        assertEquals(1, active.size());
        assertEquals("[커스텀] 예시", active.get(0).title());
    }

    @Test
    void submitJob_withSelectedStyleSet_injectsExampleVerbatimIntoPrompt() {
        ProfileResponse profile = styleService.createProfile(new CreateRequest(companyId, "결제팀"));
        styleService.addExample(profile.id(), new ExampleRequest(
                "[결제] 승인 실패 처리", "단말기 연결됨",
                List.of(new TestStep(1, "만료 카드를 삽입한다", "거절 메시지가 표시된다")),
                List.of("승인이 거절된다"), Priority.HIGH, TestType.FUNCTIONAL, 0));
        styleService.upsertConfig(new ConfigRequest(companyId, profile.id(), null, null, null));

        Long jobId = testStudioService.submitJob(
                productId, SourceType.MARKDOWN, "Spec", "# 결제 스펙\n내용", null);

        Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofMillis(200))
                .untilAsserted(() -> assertEquals(TestStudioJobStatus.DONE,
                        jobRepository.findById(jobId).orElseThrow().getStatus()));

        // Capture the prompt sent to Claude through the full real-DB pipeline.
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(clientRequest, atLeastOnce()).user(captor.capture());
        String prompt = captor.getValue();

        assertTrue(prompt.contains("[결제] 승인 실패 처리"),
                "selected style example title should be injected verbatim");
        assertTrue(prompt.contains("만료 카드를 삽입한다 → 거절 메시지가 표시된다"),
                "selected style example step should be injected verbatim");
        assertTrue(prompt.contains("예시의 내용(로그인 등)은 무시"),
                "content-ignore instruction should be present");
        assertFalse(prompt.contains("[로그인]"),
                "login Sample must NOT appear when a non-empty set is selected");
    }
}
