package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VersionServiceImplTest {
    @Mock
    private VersionRepository versionRepository;

    @Mock
    private VersionPhaseRepository versionPhaseRepository;

    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private TestRunRepository testRunRepository;

    @Mock
    private TestResultService testResultService;

    @Mock
    private VersionPhaseTestRunRepository versionPhaseTestRunRepository;

    @Mock
    private TestRunTestCaseRepository testRunTestCaseRepository;

    @Mock
    private VersionPhaseTestCaseRepository versionPhaseTestCaseRepository;

    @Mock
    private TicketRepository ticketRepository;

    @InjectMocks
    private VersionServiceImpl service;

    private ProductEntity product;
    private VersionEntity version;
    private TestRunEntity testRun;

    @BeforeEach
    void setUp() {
        product = new ProductEntity();
        product.setId(1L);
        product.setName("Test Product");

        version = new VersionEntity();
        version.setId(1L);
        version.setProduct(product);
        version.setName("v9");
        version.setDescription("Release v9");
        version.setReleaseDate(LocalDate.of(2026, 5, 1));
        version.setCreatedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());

        testRun = new TestRunEntity();
        testRun.setId(1L);
        testRun.setProduct(product);
        testRun.setName("Regression");
        testRun.setCreatedAt(LocalDateTime.now());
        testRun.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    void testCreateVersion_Simplified_Success() {
        // Given — v15: create only saves version, no phases
        VersionDto.CreateVersionRequest request = new VersionDto.CreateVersionRequest(
                1L, "v9", "Release v9", LocalDate.of(2026, 5, 1)
        );

        VersionEntity savedVersion = new VersionEntity();
        savedVersion.setId(1L);
        savedVersion.setProduct(product);
        savedVersion.setName("v9");
        savedVersion.setDescription("Release v9");
        savedVersion.setReleaseDate(LocalDate.of(2026, 5, 1));
        savedVersion.setCreatedAt(LocalDateTime.now());
        savedVersion.setUpdatedAt(LocalDateTime.now());

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(versionRepository.save(any())).thenReturn(savedVersion);
        when(versionRepository.findById(1L)).thenReturn(Optional.of(savedVersion));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.create(request);

        // Then
        assertNotNull(result);
        assertEquals("v9", result.name());
        assertTrue(result.phases().isEmpty());
        verify(productRepository).findById(1L);
        verify(versionRepository).save(any());
        // No phase/junction creation
        verify(versionPhaseRepository, never()).save(any());
        verify(versionPhaseTestRunRepository, never()).save(any());
    }

    @Test
    void testCreateVersion_ProductNotFound() {
        // Given
        VersionDto.CreateVersionRequest request = new VersionDto.CreateVersionRequest(
                999L, "v9", "Release v9", LocalDate.of(2026, 5, 1)
        );

        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.create(request));
        verify(versionRepository, never()).save(any());
    }

    @Test
    void testGetById_ReleaseDateNotPassed() {
        // Given - release_date = 2026-05-01 (future)
        VersionEntity futureVersion = new VersionEntity();
        futureVersion.setId(1L);
        futureVersion.setProduct(product);
        futureVersion.setName("v9");
        futureVersion.setReleaseDate(LocalDate.of(2026, 5, 1));
        futureVersion.setCreatedAt(LocalDateTime.now());
        futureVersion.setUpdatedAt(LocalDateTime.now());

        when(versionRepository.findById(1L)).thenReturn(Optional.of(futureVersion));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.getById(1L);

        // Then
        assertNotNull(result);
        assertFalse(result.isReleaseDatePassed());
        assertNull(result.warningMessage());
        assertEquals(LocalDate.of(2026, 5, 1), result.releaseDate());
    }

    @Test
    void testGetById_ReleaseDatePassed() {
        // Given - release_date = past date
        VersionEntity pastVersion = new VersionEntity();
        pastVersion.setId(1L);
        pastVersion.setProduct(product);
        pastVersion.setName("v8");
        pastVersion.setReleaseDate(LocalDate.of(2026, 3, 1));
        pastVersion.setCreatedAt(LocalDateTime.now());
        pastVersion.setUpdatedAt(LocalDateTime.now());

        when(versionRepository.findById(1L)).thenReturn(Optional.of(pastVersion));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.getById(1L);

        // Then
        assertNotNull(result);
        assertTrue(result.isReleaseDatePassed());
        assertNotNull(result.warningMessage());
        assertTrue(result.warningMessage().contains("2026-03-01"));
    }

    @Test
    void testGetById_NoReleaseDate() {
        // Given - release_date = null
        VersionEntity noDateVersion = new VersionEntity();
        noDateVersion.setId(1L);
        noDateVersion.setProduct(product);
        noDateVersion.setName("v10");
        noDateVersion.setReleaseDate(null);
        noDateVersion.setCreatedAt(LocalDateTime.now());
        noDateVersion.setUpdatedAt(LocalDateTime.now());

        when(versionRepository.findById(1L)).thenReturn(Optional.of(noDateVersion));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.getById(1L);

        // Then
        assertNotNull(result);
        assertFalse(result.isReleaseDatePassed());
        assertNull(result.warningMessage());
        assertNull(result.releaseDate());
    }

    @Test
    void testCopyVersion_Success() {
        // Given
        VersionEntity original = new VersionEntity();
        original.setId(1L);
        original.setProduct(product);
        original.setName("v9");
        original.setDescription("Original v9");
        original.setReleaseDate(LocalDate.of(2026, 5, 1));
        original.setCreatedAt(LocalDateTime.now());
        original.setUpdatedAt(LocalDateTime.now());

        VersionPhaseEntity originalPhase = new VersionPhaseEntity();
        originalPhase.setId(1L);
        originalPhase.setVersion(original);
        originalPhase.setPhaseName("1차 테스트");
        originalPhase.setOrderIndex(1);

        VersionPhaseTestRunEntity originalJunction = new VersionPhaseTestRunEntity();
        originalJunction.setId(1L);
        originalJunction.setVersionPhase(originalPhase);
        originalJunction.setTestRun(testRun);

        VersionEntity newVersion = new VersionEntity();
        newVersion.setId(2L);
        newVersion.setProduct(product);
        newVersion.setName("v9-延期");
        newVersion.setDescription("Original v9");
        newVersion.setReleaseDate(LocalDate.of(2026, 5, 15));
        newVersion.setCopiedFrom(1L);
        newVersion.setCreatedAt(LocalDateTime.now());
        newVersion.setUpdatedAt(LocalDateTime.now());

        VersionPhaseEntity copiedPhase = new VersionPhaseEntity();
        copiedPhase.setId(2L);
        copiedPhase.setVersion(newVersion);
        copiedPhase.setPhaseName("1차 테스트");
        copiedPhase.setOrderIndex(1);

        VersionPhaseTestRunEntity copiedJunction = new VersionPhaseTestRunEntity();
        copiedJunction.setId(2L);
        copiedJunction.setVersionPhase(copiedPhase);
        copiedJunction.setTestRun(testRun);

        VersionDto.VersionCopyRequest request = new VersionDto.VersionCopyRequest(
                "v9-延期", LocalDate.of(2026, 5, 15)
        );

        when(versionRepository.findById(1L)).thenReturn(Optional.of(original));
        when(versionRepository.findById(2L)).thenReturn(Optional.of(newVersion));
        when(versionRepository.save(any())).thenReturn(newVersion);
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L))
                .thenReturn(List.of(originalPhase));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(2L)).thenReturn(List.of(copiedPhase));
        when(versionPhaseRepository.save(any())).thenReturn(copiedPhase);
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of(originalJunction));
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(2L)).thenReturn(List.of(copiedJunction));
        when(versionPhaseTestRunRepository.save(any())).thenReturn(copiedJunction);
        when(testRunTestCaseRepository.findAllByTestRunId(1L)).thenReturn(List.of());
        when(testResultRepository.findAllByVersionPhaseId(2L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(2L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));
        when(testResultService.computePhaseProgress(2L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.copy(1L, request);

        // Then
        assertNotNull(result);
        assertEquals("v9-延期", result.name());
        assertEquals(1L, result.copiedFrom());
        assertEquals(LocalDate.of(2026, 5, 15), result.releaseDate());
        verify(versionRepository).save(any());
        verify(versionPhaseRepository).save(any());
        verify(versionPhaseTestRunRepository).save(any());
    }

    @Test
    void testCopyVersion_SetCopiedFrom() {
        // Given
        VersionEntity original = new VersionEntity();
        original.setId(1L);
        original.setProduct(product);
        original.setName("v9");
        original.setReleaseDate(LocalDate.of(2026, 5, 1));
        original.setCreatedAt(LocalDateTime.now());
        original.setUpdatedAt(LocalDateTime.now());

        VersionEntity copied = new VersionEntity();
        copied.setId(2L);
        copied.setProduct(product);
        copied.setName("v9-copy");
        copied.setCopiedFrom(1L);
        copied.setReleaseDate(LocalDate.of(2026, 5, 15));
        copied.setCreatedAt(LocalDateTime.now());
        copied.setUpdatedAt(LocalDateTime.now());

        VersionDto.VersionCopyRequest request = new VersionDto.VersionCopyRequest(
                "v9-copy", LocalDate.of(2026, 5, 15)
        );

        when(versionRepository.findById(1L)).thenReturn(Optional.of(original));
        when(versionRepository.findById(2L)).thenReturn(Optional.of(copied));
        when(versionRepository.save(any())).thenReturn(copied);
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(2L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(2L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.copy(1L, request);

        // Then
        assertNotNull(result);
        assertEquals(1L, result.copiedFrom());
        verify(versionRepository).save(any());
    }

    @Test
    void testCopyVersion_PhasesReferenceSameTestRun() {
        // Given
        VersionEntity original = new VersionEntity();
        original.setId(1L);
        original.setProduct(product);
        original.setName("v9");
        original.setReleaseDate(LocalDate.of(2026, 5, 1));
        original.setCreatedAt(LocalDateTime.now());
        original.setUpdatedAt(LocalDateTime.now());

        VersionPhaseEntity originalPhase = new VersionPhaseEntity();
        originalPhase.setId(1L);
        originalPhase.setVersion(original);
        originalPhase.setPhaseName("Regression");
        originalPhase.setOrderIndex(1);

        VersionPhaseTestRunEntity originalJunction = new VersionPhaseTestRunEntity();
        originalJunction.setId(1L);
        originalJunction.setVersionPhase(originalPhase);
        originalJunction.setTestRun(testRun);

        VersionEntity copied = new VersionEntity();
        copied.setId(2L);
        copied.setProduct(product);
        copied.setName("v9-copy");
        copied.setCopiedFrom(1L);
        copied.setReleaseDate(LocalDate.of(2026, 5, 15));
        copied.setCreatedAt(LocalDateTime.now());
        copied.setUpdatedAt(LocalDateTime.now());

        VersionPhaseEntity copiedPhase = new VersionPhaseEntity();
        copiedPhase.setId(2L);
        copiedPhase.setVersion(copied);
        copiedPhase.setPhaseName("Regression");
        copiedPhase.setOrderIndex(1);

        VersionPhaseTestRunEntity copiedJunction = new VersionPhaseTestRunEntity();
        copiedJunction.setId(2L);
        copiedJunction.setVersionPhase(copiedPhase);
        copiedJunction.setTestRun(testRun);

        VersionDto.VersionCopyRequest request = new VersionDto.VersionCopyRequest(
                "v9-copy", LocalDate.of(2026, 5, 15)
        );

        when(versionRepository.findById(1L)).thenReturn(Optional.of(original));
        when(versionRepository.findById(2L)).thenReturn(Optional.of(copied));
        when(versionRepository.save(any())).thenReturn(copied);
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L))
                .thenReturn(List.of(originalPhase));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(2L))
                .thenReturn(List.of(copiedPhase));
        when(versionPhaseRepository.save(any())).thenReturn(copiedPhase);
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of(originalJunction));
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(2L)).thenReturn(List.of(copiedJunction));
        when(versionPhaseTestRunRepository.save(any())).thenReturn(copiedJunction);
        when(testRunTestCaseRepository.findAllByTestRunId(1L)).thenReturn(List.of());
        when(testResultRepository.findAllByVersionPhaseId(2L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(2L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));
        when(testResultService.computePhaseProgress(2L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.copy(1L, request);

        // Then
        assertNotNull(result);
        assertEquals(1, result.phases().size());
        // Verify phase references same TestRun via testRuns list
        assertEquals(1, result.phases().get(0).testRuns().size());
        assertEquals(testRun.getId(), result.phases().get(0).testRuns().get(0).testRunId());
    }

    @Test
    void testUpdateVersion_ReleaseDateChangeable() {
        // Given - version with past release date
        VersionEntity pastVersion = new VersionEntity();
        pastVersion.setId(1L);
        pastVersion.setProduct(product);
        pastVersion.setName("v8");
        pastVersion.setReleaseDate(LocalDate.of(2026, 3, 1));
        pastVersion.setCreatedAt(LocalDateTime.now());
        pastVersion.setUpdatedAt(LocalDateTime.now());

        VersionEntity updated = new VersionEntity();
        updated.setId(1L);
        updated.setProduct(product);
        updated.setName("v8");
        updated.setReleaseDate(LocalDate.of(2026, 6, 1)); // Changed to future date
        updated.setCreatedAt(LocalDateTime.now());
        updated.setUpdatedAt(LocalDateTime.now());

        VersionDto.UpdateVersionRequest request = new VersionDto.UpdateVersionRequest(
                null, null, LocalDate.of(2026, 6, 1)
        );

        when(versionRepository.findById(1L)).thenReturn(Optional.of(pastVersion));
        when(versionRepository.save(any())).thenReturn(updated);
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionDetail result = service.update(1L, request);

        // Then
        assertNotNull(result);
        assertEquals(LocalDate.of(2026, 6, 1), result.releaseDate());
        verify(versionRepository).save(any());
    }

    @Test
    void testDeleteVersion_Success() {
        // Given
        when(versionRepository.findById(1L)).thenReturn(Optional.of(version));

        // When
        service.delete(1L);

        // Then
        verify(versionRepository).findById(1L);
        verify(versionRepository).delete(version);
    }

    @Test
    void testGetAllByProductId_Success() {
        // Given
        List<VersionEntity> versions = List.of(version);
        when(versionRepository.findAllByProductIdOrderByReleaseDateDescCreatedAtDesc(1L))
                .thenReturn(versions);
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(testResultService.computeVersionProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        List<VersionDto.VersionSummary> result = service.getAllByProductId(1L);

        // Then
        assertEquals(1, result.size());
        assertEquals("v9", result.get(0).name());
        verify(versionRepository).findAllByProductIdOrderByReleaseDateDescCreatedAtDesc(1L);
    }

    @Test
    void testGetFailedTestCases_ReturnsFailedTCsWithTicketCount() {
        // Given
        TestCaseEntity tc1 = new TestCaseEntity();
        tc1.setId(10L);
        tc1.setTitle("Login TC");
        tc1.setPath(new Long[]{1L, 2L});

        TestCaseEntity tc2 = new TestCaseEntity();
        tc2.setId(20L);
        tc2.setTitle("Search TC");
        tc2.setPath(null);

        VersionPhaseEntity phase1 = new VersionPhaseEntity();
        phase1.setId(1L);
        phase1.setPhaseName("Regression");

        VersionPhaseEntity phase2 = new VersionPhaseEntity();
        phase2.setId(2L);
        phase2.setPhaseName("Smoke");

        TestResultEntity r1 = new TestResultEntity();
        r1.setId(100L);
        r1.setStatus(RunResultStatus.FAIL);
        r1.setTestCase(tc1);
        r1.setVersionPhase(phase1);

        TestResultEntity r2 = new TestResultEntity();
        r2.setId(200L);
        r2.setStatus(RunResultStatus.FAIL);
        r2.setTestCase(tc2);
        r2.setVersionPhase(phase2);

        when(testResultRepository.findAllByVersionIdAndStatus(1L, RunResultStatus.FAIL))
                .thenReturn(List.of(r1, r2));
        when(ticketRepository.countByTestResultId(100L)).thenReturn(2);
        when(ticketRepository.countByTestResultId(200L)).thenReturn(0);

        // When
        List<VersionDto.FailedTestCaseInfo> result = service.getFailedTestCases(1L);

        // Then
        assertEquals(2, result.size());

        VersionDto.FailedTestCaseInfo info1 = result.get(0);
        assertEquals(10L, info1.testCaseId());
        assertEquals("Login TC", info1.testCaseTitle());
        assertEquals(List.of(1L, 2L), info1.testCasePath());
        assertEquals("Regression", info1.failedInPhaseName());
        assertEquals(2, info1.ticketCount());

        VersionDto.FailedTestCaseInfo info2 = result.get(1);
        assertEquals(20L, info2.testCaseId());
        assertEquals("Search TC", info2.testCaseTitle());
        assertEquals(List.of(), info2.testCasePath());
        assertEquals("Smoke", info2.failedInPhaseName());
        assertEquals(0, info2.ticketCount());
    }

    @Test
    void testGetFailedTestCases_DeduplicatesSameTC() {
        // Given - same TC fails in two phases, should appear once
        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(10L);
        tc.setTitle("Login TC");
        tc.setPath(new Long[]{1L});

        VersionPhaseEntity phase1 = new VersionPhaseEntity();
        phase1.setId(1L);
        phase1.setPhaseName("Regression");

        VersionPhaseEntity phase2 = new VersionPhaseEntity();
        phase2.setId(2L);
        phase2.setPhaseName("Smoke");

        TestResultEntity r1 = new TestResultEntity();
        r1.setId(100L);
        r1.setStatus(RunResultStatus.FAIL);
        r1.setTestCase(tc);
        r1.setVersionPhase(phase1);

        TestResultEntity r2 = new TestResultEntity();
        r2.setId(200L);
        r2.setStatus(RunResultStatus.FAIL);
        r2.setTestCase(tc);
        r2.setVersionPhase(phase2);

        when(testResultRepository.findAllByVersionIdAndStatus(1L, RunResultStatus.FAIL))
                .thenReturn(List.of(r1, r2));
        when(ticketRepository.countByTestResultId(100L)).thenReturn(0);

        // When
        List<VersionDto.FailedTestCaseInfo> result = service.getFailedTestCases(1L);

        // Then - deduplicated to 1 entry, first phase wins
        assertEquals(1, result.size());
        assertEquals("Regression", result.get(0).failedInPhaseName());
    }

    @Test
    void testGetFailedTestCases_EmptyResults() {
        // Given
        when(testResultRepository.findAllByVersionIdAndStatus(1L, RunResultStatus.FAIL))
                .thenReturn(List.of());

        // When
        List<VersionDto.FailedTestCaseInfo> result = service.getFailedTestCases(1L);

        // Then
        assertTrue(result.isEmpty());
    }
}
