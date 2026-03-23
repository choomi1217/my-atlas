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
                chatClient,
                new ObjectMapper()
        );

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
}
