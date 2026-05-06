package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.monitoring.AiUsageLogService;
import com.myqaweb.teststudio.SegmentPathResolver;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestCaseServiceImplTest {
    @Mock
    private TestCaseRepository testCaseRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private SegmentRepository segmentRepository;

    @Mock
    private TestCaseImageRepository testCaseImageRepository;

    @Mock
    private SegmentPathResolver segmentPathResolver;

    @Mock
    private ChatClient chatClient;

    @Mock
    private AiUsageLogService aiUsageLogService;

    private TestCaseServiceImpl testCaseService;

    private CompanyEntity company;
    private ProductEntity product;
    private TestCaseEntity testCase;

    @BeforeEach
    void setUp() {
        testCaseService = new TestCaseServiceImpl(
                testCaseRepository,
                productRepository,
                segmentRepository,
                testCaseImageRepository,
                segmentPathResolver,
                chatClient,
                new ObjectMapper(),
                aiUsageLogService
        );

        // Default stub: return empty images for any test case (lenient because not all tests invoke toResponse)
        lenient().when(testCaseImageRepository.findAllByTestCaseIdOrderByOrderIndex(anyLong()))
                .thenReturn(List.of());

        company = new CompanyEntity(1L, "Test Company", true, LocalDateTime.now());
        product = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", null, LocalDateTime.now());
        testCase = new TestCaseEntity(
                1L, product, new Long[]{1L, 2L}, null, "Test social login",
                "Social login feature", "Allow users to login with social accounts",
                "User is on login page",
                List.of(new TestStep(1, "Click social login", "OAuth popup opens")),
                List.of("Redirected to main page"),
                Priority.HIGH, TestType.FUNCTIONAL, TestStatus.DRAFT, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void testGetByProductId() {
        when(testCaseRepository.findAllByProductId(1L)).thenReturn(List.of(testCase));

        List<TestCaseDto.TestCaseResponse> result = testCaseService.getByProductId(1L);

        assertEquals(1, result.size());
        assertEquals("Test social login", result.get(0).title());
        verify(testCaseRepository).findAllByProductId(1L);
    }

    @Test
    void testCreate() {
        TestCaseDto.TestCaseRequest request = new TestCaseDto.TestCaseRequest(
                1L, new Long[]{1L, 2L}, "Test login",
                "Social login desc", "Prompt text",
                "Precondition", List.of(), List.of("Expected result"),
                Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(testCaseRepository.save(any())).thenReturn(testCase);

        TestCaseDto.TestCaseResponse result = testCaseService.create(request);

        assertNotNull(result);
        assertEquals("Test social login", result.title());
        verify(productRepository).findById(1L);
        verify(testCaseRepository).save(any());
    }

    @Test
    void testUpdate() {
        TestCaseDto.TestCaseRequest request = new TestCaseDto.TestCaseRequest(
                1L, new Long[]{1L}, "Updated test",
                "Updated desc", "Updated prompt",
                "Updated precondition", List.of(), List.of("Updated expected"),
                Priority.LOW, TestType.REGRESSION, TestStatus.ACTIVE
        );

        TestCaseEntity updatedEntity = new TestCaseEntity(
                1L, product, new Long[]{1L}, null, "Updated test",
                "Updated desc", "Updated prompt",
                "Updated precondition",
                List.of(), List.of("Updated expected"),
                Priority.LOW, TestType.REGRESSION, TestStatus.ACTIVE, null,
                testCase.getCreatedAt(), LocalDateTime.now()
        );

        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(testCase));
        when(testCaseRepository.save(any())).thenReturn(updatedEntity);

        TestCaseDto.TestCaseResponse result = testCaseService.update(1L, request);

        assertEquals("Updated test", result.title());
        assertEquals(TestStatus.ACTIVE, result.status());
        verify(testCaseRepository).findById(1L);
        verify(testCaseRepository).save(any());
    }

    @Test
    void testDelete() {
        when(testCaseRepository.existsById(1L)).thenReturn(true);
        testCaseService.delete(1L);
        verify(testCaseRepository).deleteByIdDirectly(1L);
    }

    @Test
    void testDeleteNotFound() {
        when(testCaseRepository.existsById(99L)).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> testCaseService.delete(99L));
    }

    @Test
    void testCreateProductNotFound() {
        TestCaseDto.TestCaseRequest request = new TestCaseDto.TestCaseRequest(
                99L, new Long[]{}, "Test", null, null,
                null, List.of(), null,
                Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT
        );

        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> testCaseService.create(request));
    }

    @Test
    void testGenerateDraftProductNotFound() {
        TestCaseDto.GenerateDraftRequest request = new TestCaseDto.GenerateDraftRequest(99L, new Long[]{});

        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> testCaseService.generateDraft(request));
    }

    // --- generateDraft success ---

    @Test
    void testGenerateDraft_success_returnsAIDraftedTestCases() {
        // Arrange
        TestCaseDto.GenerateDraftRequest request = new TestCaseDto.GenerateDraftRequest(1L, new Long[]{1L});

        SegmentEntity segment = new SegmentEntity();
        segment.setId(1L);
        segment.setName("Login");

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(segmentRepository.findById(1L)).thenReturn(Optional.of(segment));

        // Mock ChatClient for synchronous call → chatResponse()
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec = mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        String aiResponse = """
                [{"order": 1, "action": "Enter valid credentials", "expected": "Login succeeds"}]
                """;
        Generation generation = new Generation(aiResponse);
        Usage usage = mock(Usage.class);
        when(usage.getPromptTokens()).thenReturn(100L);
        when(usage.getGenerationTokens()).thenReturn(50L);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(callSpec.chatResponse()).thenReturn(chatResponse);
        when(clientRequest.call()).thenReturn(callSpec);

        TestCaseEntity savedEntity = new TestCaseEntity(
                10L, product, new Long[]{1L}, null, "AI Draft: Login",
                null, null, null,
                List.of(new TestStep(1, "Enter valid credentials", "Login succeeds")),
                null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
        when(testCaseRepository.save(any())).thenReturn(savedEntity);

        // Act
        List<TestCaseDto.TestCaseResponse> result = testCaseService.generateDraft(request);

        // Assert
        assertFalse(result.isEmpty(), "Should return at least one draft");
        assertEquals("AI Draft: Login", result.get(0).title());
        assertFalse(result.get(0).steps().isEmpty(), "Should have parsed steps");
        verify(testCaseRepository).save(any());
    }

    @Test
    void testGenerateDraft_aiReturnsInvalidJson_returnsEmptyList() {
        // Arrange
        TestCaseDto.GenerateDraftRequest request = new TestCaseDto.GenerateDraftRequest(1L, new Long[]{});

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec = mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        Generation generation = new Generation("This is not valid JSON at all");
        Usage usage = mock(Usage.class);
        when(usage.getPromptTokens()).thenReturn(50L);
        when(usage.getGenerationTokens()).thenReturn(20L);
        ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
        when(metadata.getUsage()).thenReturn(usage);
        ChatResponse chatResponse = new ChatResponse(List.of(generation), metadata);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(callSpec.chatResponse()).thenReturn(chatResponse);
        when(clientRequest.call()).thenReturn(callSpec);

        TestCaseEntity savedEntity = new TestCaseEntity(
                11L, product, new Long[]{}, null, "AI Draft: ",
                null, null, null, List.of(), null,
                Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT, null,
                LocalDateTime.now(), LocalDateTime.now()
        );
        when(testCaseRepository.save(any())).thenReturn(savedEntity);

        // Act
        List<TestCaseDto.TestCaseResponse> result = testCaseService.generateDraft(request);

        // Assert — should still return result but with empty steps (graceful)
        assertFalse(result.isEmpty());
        assertTrue(result.get(0).steps().isEmpty(), "Invalid JSON should result in empty steps");
    }

    // ==========================================================================
    // v2: Company-scoped listing
    // ==========================================================================

    @Test
    void getByCompanyId_allStatuses_delegatesToRepo() {
        // Arrange — status=null means "no status filter"
        when(testCaseRepository.findAllByCompanyId(1L)).thenReturn(List.of(testCase));

        // Act
        List<TestCaseDto.TestCaseResponse> result = testCaseService.getByCompanyId(1L, null);

        // Assert
        assertEquals(1, result.size());
        verify(testCaseRepository).findAllByCompanyId(1L);
        verify(testCaseRepository, never()).findAllByCompanyIdAndStatus(anyLong(), any());
    }

    @Test
    void getByCompanyId_draftFilter_delegatesToStatusRepo() {
        // Arrange
        when(testCaseRepository.findAllByCompanyIdAndStatus(1L, TestStatus.DRAFT))
                .thenReturn(List.of(testCase));

        // Act
        List<TestCaseDto.TestCaseResponse> result =
                testCaseService.getByCompanyId(1L, TestStatus.DRAFT);

        // Assert
        assertEquals(1, result.size());
        verify(testCaseRepository).findAllByCompanyIdAndStatus(1L, TestStatus.DRAFT);
        verify(testCaseRepository, never()).findAllByCompanyId(anyLong());
    }

    // ==========================================================================
    // v2: updatePath — validates path, saves, returns
    // ==========================================================================

    @Test
    void updatePath_success_validatesAndSaves() {
        // Arrange — path [10, 20] with 20's parent=10, both under product 1
        SegmentEntity root = new SegmentEntity();
        root.setId(10L);
        root.setName("결제");
        root.setProduct(product);
        root.setParent(null);

        SegmentEntity child = new SegmentEntity();
        child.setId(20L);
        child.setName("NFC");
        child.setProduct(product);
        child.setParent(root);

        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(testCase));
        when(segmentRepository.findById(10L)).thenReturn(Optional.of(root));
        when(segmentRepository.findById(20L)).thenReturn(Optional.of(child));
        when(testCaseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        TestCaseDto.TestCaseResponse result =
                testCaseService.updatePath(1L, new Long[]{10L, 20L});

        // Assert
        ArgumentCaptor<TestCaseEntity> captor = ArgumentCaptor.forClass(TestCaseEntity.class);
        verify(testCaseRepository).save(captor.capture());
        assertArrayEquals(new Long[]{10L, 20L}, captor.getValue().getPath());
        assertNotNull(result);
    }

    @Test
    void updatePath_wrongProduct_throws() {
        // Arrange — segment 10 exists but belongs to a DIFFERENT product (id=999)
        CompanyEntity otherCompany = new CompanyEntity(2L, "Other", true, LocalDateTime.now());
        ProductEntity otherProduct = new ProductEntity(
                999L, otherCompany, "Other Product", Platform.WEB, null, null, LocalDateTime.now());

        SegmentEntity wrongProductSeg = new SegmentEntity();
        wrongProductSeg.setId(10L);
        wrongProductSeg.setName("결제");
        wrongProductSeg.setProduct(otherProduct);
        wrongProductSeg.setParent(null);

        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(testCase));
        when(segmentRepository.findById(10L)).thenReturn(Optional.of(wrongProductSeg));

        // Act & Assert
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> testCaseService.updatePath(1L, new Long[]{10L}));
        assertTrue(ex.getMessage().contains("does not belong"),
                "Expected 'does not belong' message, got: " + ex.getMessage());
        verify(testCaseRepository, never()).save(any());
    }

    @Test
    void updatePath_invalidParentChain_throws() {
        // Arrange — seg 20's parent is 10, but caller sends [20, 10] (wrong order)
        SegmentEntity root = new SegmentEntity();
        root.setId(10L);
        root.setName("결제");
        root.setProduct(product);
        root.setParent(null);

        SegmentEntity child = new SegmentEntity();
        child.setId(20L);
        child.setName("NFC");
        child.setProduct(product);
        child.setParent(root);

        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(testCase));
        when(segmentRepository.findById(20L)).thenReturn(Optional.of(child));
        // First segment (20) expects parent=null but has parent=10 → chain invalid.

        // Act & Assert
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> testCaseService.updatePath(1L, new Long[]{20L, 10L}));
        assertTrue(ex.getMessage().contains("Invalid path chain"),
                "Expected 'Invalid path chain' message, got: " + ex.getMessage());
        verify(testCaseRepository, never()).save(any());
    }

    // ==========================================================================
    // v2: applySuggestedPath — single TC user-triggered apply
    // ==========================================================================

    @Test
    void applySuggestedPath_noSuggestion_returnsNoSuggestion() {
        // Arrange — TC with no suggestion stored
        TestCaseEntity tcNoSuggestion = new TestCaseEntity(
                5L, product, new Long[0], null, "No suggestion", null, null, null,
                List.of(), null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
                null, LocalDateTime.now(), LocalDateTime.now());
        when(testCaseRepository.findById(5L)).thenReturn(Optional.of(tcNoSuggestion));

        // Act
        TestCaseDto.ApplySuggestedPathResponse response = testCaseService.applySuggestedPath(5L);

        // Assert
        assertEquals(5L, response.testCaseId());
        assertArrayEquals(new Long[0], response.resolvedPath());
        assertEquals(0, response.resolvedLength());
        assertFalse(response.fullMatch());
        assertEquals(0, response.suggestedLength());
        assertEquals(0, response.createdSegmentCount());
        assertEquals("NO_SUGGESTION", response.error());

        // Resolver must NOT be invoked in the no-suggestion path
        verifyNoInteractions(segmentPathResolver);
        verify(testCaseRepository, never()).save(any());
    }

    @Test
    void applySuggestedPath_withSuggestion_callsResolveOrCreate_andSavesPath() {
        // Arrange — TC with suggestedSegmentPath = ["결제", "NFC"]
        TestCaseEntity tcWithSuggestion = new TestCaseEntity(
                7L, product, new Long[0], null, "Has suggestion", null, null, null,
                List.of(), null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
                null, LocalDateTime.now(), LocalDateTime.now());
        tcWithSuggestion.setSuggestedSegmentPath(new String[]{"결제", "NFC"});

        when(testCaseRepository.findById(7L)).thenReturn(Optional.of(tcWithSuggestion));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        SegmentPathResolver.ResolverContext ctx =
                new SegmentPathResolver.ResolverContext(new java.util.HashMap<>());
        when(segmentPathResolver.buildContext(1L)).thenReturn(ctx);
        when(segmentPathResolver.resolveOrCreate(eq(ctx), eq(product), anyList()))
                .thenReturn(new SegmentPathResolver.ResolveResult(new Long[]{100L, 200L}, 1));

        when(testCaseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        TestCaseDto.ApplySuggestedPathResponse response = testCaseService.applySuggestedPath(7L);

        // Assert
        assertEquals(7L, response.testCaseId());
        assertArrayEquals(new Long[]{100L, 200L}, response.resolvedPath());
        assertEquals(2, response.resolvedLength());
        assertTrue(response.fullMatch(), "Resolved length equals suggested length → fullMatch=true");
        assertEquals(2, response.suggestedLength());
        assertEquals(1, response.createdSegmentCount());
        assertNull(response.error());

        verify(segmentPathResolver).buildContext(1L);
        verify(segmentPathResolver).resolveOrCreate(eq(ctx), eq(product), anyList());

        ArgumentCaptor<TestCaseEntity> saveCaptor = ArgumentCaptor.forClass(TestCaseEntity.class);
        verify(testCaseRepository).save(saveCaptor.capture());
        assertArrayEquals(new Long[]{100L, 200L}, saveCaptor.getValue().getPath());
    }

    // ==========================================================================
    // v2: bulkApplySuggestedPath — shared context per product
    // ==========================================================================

    @Test
    void bulkApplySuggestedPath_sharesContextAcrossSameProduct() {
        // Arrange — two TCs both under product 1 (reused fixture `product`)
        TestCaseEntity tc1 = new TestCaseEntity(
                101L, product, new Long[0], null, "TC1", null, null, null,
                List.of(), null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
                null, LocalDateTime.now(), LocalDateTime.now());
        tc1.setSuggestedSegmentPath(new String[]{"결제", "NFC"});

        TestCaseEntity tc2 = new TestCaseEntity(
                102L, product, new Long[0], null, "TC2", null, null, null,
                List.of(), null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
                null, LocalDateTime.now(), LocalDateTime.now());
        tc2.setSuggestedSegmentPath(new String[]{"결제", "카드"});

        when(testCaseRepository.findAllById(List.of(101L, 102L)))
                .thenReturn(List.of(tc1, tc2));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        SegmentPathResolver.ResolverContext sharedCtx =
                new SegmentPathResolver.ResolverContext(new java.util.HashMap<>());
        when(segmentPathResolver.buildContext(1L)).thenReturn(sharedCtx);
        when(segmentPathResolver.resolveOrCreate(eq(sharedCtx), eq(product), anyList()))
                .thenReturn(new SegmentPathResolver.ResolveResult(new Long[]{100L, 200L}, 1))
                .thenReturn(new SegmentPathResolver.ResolveResult(new Long[]{100L, 300L}, 1));

        when(testCaseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        List<TestCaseDto.ApplySuggestedPathResponse> results =
                testCaseService.bulkApplySuggestedPath(List.of(101L, 102L));

        // Assert — buildContext called ONCE per product (shared across TCs)
        verify(segmentPathResolver, times(1)).buildContext(1L);
        // And product fetched once per product too
        verify(productRepository, times(1)).findById(1L);
        // resolveOrCreate is called once per TC with the same shared context
        verify(segmentPathResolver, times(2)).resolveOrCreate(eq(sharedCtx), eq(product), anyList());

        assertEquals(2, results.size());
        assertEquals(101L, results.get(0).testCaseId());
        assertArrayEquals(new Long[]{100L, 200L}, results.get(0).resolvedPath());
        assertEquals(1, results.get(0).createdSegmentCount());
        assertEquals(102L, results.get(1).testCaseId());
        assertArrayEquals(new Long[]{100L, 300L}, results.get(1).resolvedPath());
        assertEquals(1, results.get(1).createdSegmentCount());
    }

    @Test
    void bulkApplySuggestedPath_notFound_yieldsNotFoundEntry() {
        // Arrange — ids [101, 999] but findAllById returns only tc1 (999 missing)
        TestCaseEntity tc1 = new TestCaseEntity(
                101L, product, new Long[0], null, "TC1", null, null, null,
                List.of(), null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
                null, LocalDateTime.now(), LocalDateTime.now());
        tc1.setSuggestedSegmentPath(new String[]{"결제"});

        when(testCaseRepository.findAllById(List.of(101L, 999L)))
                .thenReturn(List.of(tc1));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        SegmentPathResolver.ResolverContext ctx =
                new SegmentPathResolver.ResolverContext(new java.util.HashMap<>());
        when(segmentPathResolver.buildContext(1L)).thenReturn(ctx);
        when(segmentPathResolver.resolveOrCreate(eq(ctx), eq(product), anyList()))
                .thenReturn(new SegmentPathResolver.ResolveResult(new Long[]{100L}, 0));

        when(testCaseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        List<TestCaseDto.ApplySuggestedPathResponse> results =
                testCaseService.bulkApplySuggestedPath(List.of(101L, 999L));

        // Assert
        assertEquals(2, results.size());

        // First entry: normal resolution for tc1
        assertEquals(101L, results.get(0).testCaseId());
        assertArrayEquals(new Long[]{100L}, results.get(0).resolvedPath());
        assertNull(results.get(0).error());

        // Second entry: NOT_FOUND for id=999
        assertEquals(999L, results.get(1).testCaseId());
        assertArrayEquals(new Long[0], results.get(1).resolvedPath());
        assertEquals(0, results.get(1).resolvedLength());
        assertFalse(results.get(1).fullMatch());
        assertEquals(0, results.get(1).createdSegmentCount());
        assertEquals("NOT_FOUND", results.get(1).error());
    }
}
