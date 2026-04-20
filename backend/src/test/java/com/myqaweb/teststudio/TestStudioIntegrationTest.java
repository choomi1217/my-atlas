package com.myqaweb.teststudio;

import com.myqaweb.common.BaseIntegrationTest;
import com.myqaweb.feature.CompanyEntity;
import com.myqaweb.feature.CompanyRepository;
import com.myqaweb.feature.Platform;
import com.myqaweb.feature.ProductEntity;
import com.myqaweb.feature.ProductRepository;
import com.myqaweb.feature.TestCaseEntity;
import com.myqaweb.feature.TestCaseRepository;
import com.myqaweb.feature.TestStatus;
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

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Integration tests for Test Studio pipeline using real pgvector database.
 *
 * <p>Uses Testcontainers + Flyway to validate:
 * <ul>
 *     <li>test_studio_job row lifecycle (PENDING → PROCESSING → DONE)</li>
 *     <li>test_case.test_studio_job_id FK linkage</li>
 *     <li>ON DELETE SET NULL behavior — deleting a job preserves DRAFT TCs</li>
 * </ul>
 *
 * <p>External services mocked: {@link ChatClient} (no real Anthropic call)
 * and {@code EmbeddingService} (mocked via {@link BaseIntegrationTest}).
 */
class TestStudioIntegrationTest extends BaseIntegrationTest {

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

    @MockBean
    private ChatClient chatClient;

    private Long productId;

    private static final String VALID_RESPONSE = """
            [
              {
                "title": "[IT] Integration TC 1",
                "preconditions": "System up",
                "steps": [{"order": 1, "action": "Do thing", "expected": "Ok"}],
                "expectedResult": "Works",
                "priority": "HIGH",
                "testType": "FUNCTIONAL",
                "suggestedSegmentPath": ["Integration"]
              },
              {
                "title": "[IT] Integration TC 2",
                "preconditions": "System up",
                "steps": [{"order": 1, "action": "Other thing", "expected": "Ok"}],
                "expectedResult": "Works too",
                "priority": "LOW",
                "testType": "REGRESSION",
                "suggestedSegmentPath": ["Integration"]
              }
            ]
            """;

    @BeforeEach
    void setUp() {
        // Clean up only the rows we create (preserve knowledge_base / pdf_upload_job)
        testCaseRepository.deleteAll();
        jobRepository.deleteAll();
        productRepository.deleteAll();
        companyRepository.deleteAll();

        CompanyEntity company = new CompanyEntity();
        company.setName("IT Corp");
        company.setIsActive(true);
        CompanyEntity savedCompany = companyRepository.save(company);

        ProductEntity product = new ProductEntity();
        product.setCompany(savedCompany);
        product.setName("IT Product");
        product.setPlatform(Platform.WEB);
        product.setDescription("Integration-test product");
        ProductEntity savedProduct = productRepository.save(product);
        productId = savedProduct.getId();

        // Mock embedding (fast, no API call)
        float[] zeros = new float[1536];
        when(embeddingService.embed(anyString(), any())).thenReturn(zeros);
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[" + "0," .repeat(1535) + "0]");

        // Mock chatClient fluent chain → chatResponse()
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec =
                mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        Generation generation = new Generation(VALID_RESPONSE);
        Usage usage = mock(Usage.class);
        lenient().when(usage.getPromptTokens()).thenReturn(200L);
        lenient().when(usage.getGenerationTokens()).thenReturn(100L);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        lenient().when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.options(any(org.springframework.ai.chat.prompt.ChatOptions.class)))
                .thenReturn(clientRequest);
        when(clientRequest.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(chatResponse);
    }

    @Test
    void submitMarkdownJob_endToEnd_createsDraftTestCases() {
        // Act — submit job
        Long jobId = testStudioService.submitJob(
                productId, SourceType.MARKDOWN, "IT Spec", "# Integration\n\nSome content.", null);

        // Await async completion
        Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofMillis(200))
                .untilAsserted(() -> {
                    TestStudioJobEntity j = jobRepository.findById(jobId).orElseThrow();
                    assertEquals(TestStudioJobStatus.DONE, j.getStatus(),
                            "Job should reach DONE (errorMessage=" + j.getErrorMessage() + ")");
                });

        // Assert job state
        TestStudioJobEntity finalJob = jobRepository.findById(jobId).orElseThrow();
        assertEquals(TestStudioJobStatus.DONE, finalJob.getStatus());
        assertEquals(2, finalJob.getGeneratedCount(), "Expected 2 DRAFT TCs generated");
        assertNotNull(finalJob.getCompletedAt());
        assertNull(finalJob.getErrorMessage());

        // Assert TCs persisted with DRAFT + testStudioJobId
        List<TestCaseEntity> tcs = testCaseRepository.findAllByProductId(productId);
        assertEquals(2, tcs.size());
        for (TestCaseEntity tc : tcs) {
            assertEquals(TestStatus.DRAFT, tc.getStatus());
            assertEquals(jobId, tc.getTestStudioJobId());
        }
    }

    @Test
    void deleteJob_preservesDraftTestCases() {
        // Arrange — run a job to DONE so we have DRAFT TCs linked to it
        Long jobId = testStudioService.submitJob(
                productId, SourceType.MARKDOWN, "Delete test", "# Content", null);

        Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofMillis(200))
                .untilAsserted(() -> {
                    TestStudioJobEntity j = jobRepository.findById(jobId).orElseThrow();
                    assertEquals(TestStudioJobStatus.DONE, j.getStatus());
                });

        List<TestCaseEntity> tcsBefore = testCaseRepository.findAllByProductId(productId);
        assertEquals(2, tcsBefore.size(), "Precondition: 2 DRAFT TCs created");

        // Act — delete the job
        testStudioService.deleteJob(jobId);

        // Assert — job gone, TCs still exist but testStudioJobId is null (ON DELETE SET NULL)
        Optional<TestStudioJobEntity> jobGone = jobRepository.findById(jobId);
        assertTrue(jobGone.isEmpty(), "Job should be deleted");

        List<TestCaseEntity> tcsAfter = testCaseRepository.findAllByProductId(productId);
        assertEquals(2, tcsAfter.size(), "DRAFT TCs should be preserved");
        for (TestCaseEntity tc : tcsAfter) {
            assertEquals(TestStatus.DRAFT, tc.getStatus());
            assertNull(tc.getTestStudioJobId(),
                    "testStudioJobId should be NULL after job deletion (ON DELETE SET NULL)");
        }
    }
}
