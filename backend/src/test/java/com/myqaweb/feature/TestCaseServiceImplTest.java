package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
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
    private FeatureRepository featureRepository;

    @Mock
    private ChatClient chatClient;

    @InjectMocks
    private TestCaseServiceImpl testCaseService;

    private CompanyEntity company;
    private ProductEntity product;
    private FeatureEntity feature;
    private TestCaseEntity testCase;

    @BeforeEach
    void setUp() {
        testCaseService = new TestCaseServiceImpl(
                testCaseRepository,
                featureRepository,
                chatClient,
                new ObjectMapper()
        );

        company = new CompanyEntity(1L, "Test Company", true, LocalDateTime.now());
        product = new ProductEntity(1L, company, "Product A", Platform.WEB, "Web app", LocalDateTime.now());
        feature = new FeatureEntity(
                1L, product, "Main › Login", "Social Login",
                "Social login feature", "Allow users to login with social accounts",
                new float[1536], LocalDateTime.now(), LocalDateTime.now()
        );
        testCase = new TestCaseEntity(
                1L, feature, "Test social login",
                "User is on login page",
                List.of(new TestStep(1, "Click social login", "OAuth popup opens")),
                "Redirected to main page",
                Priority.HIGH, TestType.FUNCTIONAL, TestStatus.DRAFT,
                LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void testGetByFeatureId() {
        when(testCaseRepository.findAllByFeatureId(1L)).thenReturn(List.of(testCase));

        List<TestCaseDto.TestCaseResponse> result = testCaseService.getByFeatureId(1L);

        assertEquals(1, result.size());
        assertEquals("Test social login", result.get(0).title());
        verify(testCaseRepository).findAllByFeatureId(1L);
    }

    @Test
    void testCreate() {
        TestCaseDto.TestCaseRequest request = new TestCaseDto.TestCaseRequest(
                1L, "Test login", "Precondition", List.of(), "Expected result",
                Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT
        );

        when(featureRepository.findById(1L)).thenReturn(Optional.of(feature));
        when(testCaseRepository.save(any())).thenReturn(testCase);

        TestCaseDto.TestCaseResponse result = testCaseService.create(request);

        assertNotNull(result);
        assertEquals("Test social login", result.title());
        verify(featureRepository).findById(1L);
        verify(testCaseRepository).save(any());
    }

    @Test
    void testUpdate() {
        TestCaseDto.TestCaseRequest request = new TestCaseDto.TestCaseRequest(
                1L, "Updated test", "Updated precondition", List.of(), "Updated expected",
                Priority.LOW, TestType.REGRESSION, TestStatus.ACTIVE
        );

        TestCaseEntity updatedEntity = new TestCaseEntity(
                1L, feature, "Updated test", "Updated precondition",
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
        testCaseService.delete(1L);
        verify(testCaseRepository).deleteById(1L);
    }

    @Test
    void testCreateFeatureNotFound() {
        TestCaseDto.TestCaseRequest request = new TestCaseDto.TestCaseRequest(
                99L, "Test", null, List.of(), null,
                Priority.MEDIUM, TestType.FUNCTIONAL, TestStatus.DRAFT
        );

        when(featureRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> testCaseService.create(request));
    }

    @Test
    void testGenerateDraftFeatureNotFound() {
        when(featureRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> testCaseService.generateDraft(99L));
    }
}
