package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;

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
    private ChatClient chatClient;

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
                chatClient,
                new ObjectMapper()
        );

        // Default stub: return empty images for any test case (lenient because not all tests invoke toResponse)
        lenient().when(testCaseImageRepository.findAllByTestCaseIdOrderByOrderIndex(anyLong()))
                .thenReturn(List.of());

        company = new CompanyEntity(1L, "Test Company", true, LocalDateTime.now());
        product = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", LocalDateTime.now());
        testCase = new TestCaseEntity(
                1L, product, new Long[]{1L, 2L}, "Test social login",
                "Social login feature", "Allow users to login with social accounts",
                "User is on login page",
                List.of(new TestStep(1, "Click social login", "OAuth popup opens")),
                "Redirected to main page",
                Priority.HIGH, TestType.FUNCTIONAL, TestStatus.DRAFT,
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
                "Precondition", List.of(), "Expected result",
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
                "Updated precondition", List.of(), "Updated expected",
                Priority.LOW, TestType.REGRESSION, TestStatus.ACTIVE
        );

        TestCaseEntity updatedEntity = new TestCaseEntity(
                1L, product, new Long[]{1L}, "Updated test",
                "Updated desc", "Updated prompt",
                "Updated precondition",
                List.of(), "Updated expected",
                Priority.LOW, TestType.REGRESSION, TestStatus.ACTIVE,
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

        // Mock ChatClient for synchronous call
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.CallResponseSpec callSpec = mock(ChatClient.ChatClientRequest.CallResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(callSpec.content()).thenReturn("""
                [{"order": 1, "action": "Enter valid credentials", "expected": "Login succeeds"}]
                """);
        when(clientRequest.call()).thenReturn(callSpec);

        TestCaseEntity savedEntity = new TestCaseEntity(
                10L, product, new Long[]{1L}, "AI Draft: Login",
                null, null, null,
                List.of(new TestStep(1, "Enter valid credentials", "Login succeeds")),
                null, Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
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

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(callSpec.content()).thenReturn("This is not valid JSON at all");
        when(clientRequest.call()).thenReturn(callSpec);

        TestCaseEntity savedEntity = new TestCaseEntity(
                11L, product, new Long[]{}, "AI Draft: ",
                null, null, null, List.of(), null,
                Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT,
                LocalDateTime.now(), LocalDateTime.now()
        );
        when(testCaseRepository.save(any())).thenReturn(savedEntity);

        // Act
        List<TestCaseDto.TestCaseResponse> result = testCaseService.generateDraft(request);

        // Assert — should still return result but with empty steps (graceful)
        assertFalse(result.isEmpty());
        assertTrue(result.get(0).steps().isEmpty(), "Invalid JSON should result in empty steps");
    }
}
