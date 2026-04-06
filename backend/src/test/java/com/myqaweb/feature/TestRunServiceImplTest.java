package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestRunServiceImplTest {
    @Mock
    private TestRunRepository testRunRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private TestCaseRepository testCaseRepository;

    @Mock
    private TestRunTestCaseRepository testRunTestCaseRepository;

    @Mock
    private TestResultRepository testResultRepository;

    @InjectMocks
    private TestRunServiceImpl service;

    private ProductEntity product;
    private TestRunEntity testRun;
    private TestCaseEntity testCase1;
    private TestCaseEntity testCase2;

    @BeforeEach
    void setUp() {
        product = new ProductEntity();
        product.setId(1L);
        product.setName("Test Product");

        testRun = new TestRunEntity();
        testRun.setId(1L);
        testRun.setProduct(product);
        testRun.setName("Regression");
        testRun.setDescription("Regression Test Suite");
        testRun.setCreatedAt(LocalDateTime.now());
        testRun.setUpdatedAt(LocalDateTime.now());

        testCase1 = new TestCaseEntity();
        testCase1.setId(1L);
        testCase1.setTitle("Login Test");

        testCase2 = new TestCaseEntity();
        testCase2.setId(2L);
        testCase2.setTitle("Logout Test");
    }

    @Test
    void testCreateTestRun_Success() {
        // Given
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
                1L, "Regression", "Regression Test Suite", List.of(1L, 2L)
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(testCaseRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(testCase1, testCase2));
        when(testRunRepository.save(any())).thenReturn(testRun);

        // When
        TestRunDto.TestRunDetail result = service.create(request);

        // Then
        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals("Regression", result.name());
        assertEquals("Regression Test Suite", result.description());
        verify(productRepository).findById(1L);
        verify(testCaseRepository).findAllById(List.of(1L, 2L));
        verify(testRunRepository).save(any());
    }

    @Test
    void testCreateTestRun_ProductNotFound() {
        // Given
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
                999L, "Regression", "Regression Test Suite", List.of(1L, 2L)
        );

        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.create(request));
        verify(productRepository).findById(999L);
        verify(testRunRepository, never()).save(any());
    }

    @Test
    void testCreateTestRun_TestCaseNotFound() {
        // Given
        TestRunDto.CreateTestRunRequest request = new TestRunDto.CreateTestRunRequest(
                1L, "Regression", "Regression Test Suite", List.of(1L, 2L, 999L)
        );

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(testCaseRepository.findAllById(List.of(1L, 2L, 999L)))
                .thenReturn(List.of(testCase1, testCase2)); // Missing testCase 999L

        // When & Then
        assertThrows(IllegalArgumentException.class, () -> service.create(request));
        verify(testRunRepository, never()).save(any());
    }

    @Test
    void testGetAllByProductId_Success() {
        // Given
        TestRunEntity testRun2 = new TestRunEntity();
        testRun2.setId(2L);
        testRun2.setProduct(product);
        testRun2.setName("Smoke Test");
        testRun2.setCreatedAt(LocalDateTime.now());
        testRun2.setUpdatedAt(LocalDateTime.now());

        when(testRunRepository.findAllByProductIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(testRun2, testRun));

        // When
        List<TestRunDto.TestRunSummary> result = service.getAllByProductId(1L);

        // Then
        assertEquals(2, result.size());
        assertEquals("Smoke Test", result.get(0).name());
        assertEquals("Regression", result.get(1).name());
        verify(testRunRepository).findAllByProductIdOrderByCreatedAtDesc(1L);
    }

    @Test
    void testGetById_Success() {
        // Given
        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun));

        // When
        TestRunDto.TestRunDetail result = service.getById(1L);

        // Then
        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals("Regression", result.name());
        verify(testRunRepository).findById(1L);
    }

    @Test
    void testGetById_NotFound() {
        // Given
        when(testRunRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.getById(999L));
        verify(testRunRepository).findById(999L);
    }

    @Test
    void testUpdateTestRun_Success() {
        // Given
        TestRunDto.UpdateTestRunRequest request = new TestRunDto.UpdateTestRunRequest(
                "Updated Regression", "Updated Description", null
        );

        TestRunEntity updated = new TestRunEntity();
        updated.setId(1L);
        updated.setProduct(product);
        updated.setName("Updated Regression");
        updated.setDescription("Updated Description");
        updated.setCreatedAt(LocalDateTime.now());
        updated.setUpdatedAt(LocalDateTime.now());

        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun));
        when(testRunRepository.save(any())).thenReturn(updated);

        // When
        TestRunDto.TestRunDetail result = service.update(1L, request);

        // Then
        assertNotNull(result);
        assertEquals("Updated Regression", result.name());
        assertEquals("Updated Description", result.description());
        verify(testRunRepository).findById(1L);
        verify(testRunRepository).save(any());
    }

    @Test
    void testUpdateTestRun_PartialUpdate() {
        // Given
        TestRunDto.UpdateTestRunRequest request = new TestRunDto.UpdateTestRunRequest(
                "New Name", null, null
        );

        TestRunEntity updated = new TestRunEntity();
        updated.setId(1L);
        updated.setProduct(product);
        updated.setName("New Name");
        updated.setDescription("Regression Test Suite");
        updated.setCreatedAt(LocalDateTime.now());
        updated.setUpdatedAt(LocalDateTime.now());

        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun));
        when(testRunRepository.save(any())).thenReturn(updated);

        // When
        TestRunDto.TestRunDetail result = service.update(1L, request);

        // Then
        assertNotNull(result);
        assertEquals("New Name", result.name());
        verify(testRunRepository).findById(1L);
        verify(testRunRepository).save(any());
    }

    @Test
    void testDeleteTestRun_Success() {
        // Given
        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun));

        // When
        service.deleteTestRun(1L);

        // Then
        verify(testRunRepository).findById(1L);
        verify(testResultRepository).deleteByTestRunIdViaPhase(1L);
        verify(testRunTestCaseRepository).deleteByTestRunId(1L);
        verify(testRunRepository).deleteById(1L);
    }

    @Test
    void testDeleteTestRun_NotFound() {
        // Given
        when(testRunRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.delete(999L));
        verify(testRunRepository, never()).delete(any());
    }
}
