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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VersionPhaseServiceImplTest {
    @Mock
    private VersionPhaseRepository versionPhaseRepository;

    @Mock
    private VersionRepository versionRepository;

    @Mock
    private TestRunRepository testRunRepository;

    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private TestResultService testResultService;

    @Mock
    private VersionPhaseTestRunRepository versionPhaseTestRunRepository;

    @Mock
    private TestRunTestCaseRepository testRunTestCaseRepository;

    @Mock
    private VersionPhaseTestCaseRepository versionPhaseTestCaseRepository;

    @Mock
    private TestCaseRepository testCaseRepository;

    @InjectMocks
    private VersionPhaseServiceImpl service;

    private VersionPhaseEntity phase;
    private VersionEntity version;
    private TestRunEntity testRun1;
    private TestRunEntity testRun2;

    @BeforeEach
    void setUp() {
        version = new VersionEntity();
        version.setId(1L);
        version.setName("v9");

        testRun1 = new TestRunEntity();
        testRun1.setId(1L);
        testRun1.setName("Regression");
        testRun1.setCreatedAt(LocalDateTime.now());
        testRun1.setUpdatedAt(LocalDateTime.now());

        testRun2 = new TestRunEntity();
        testRun2.setId(2L);
        testRun2.setName("1차 테스트");
        testRun2.setCreatedAt(LocalDateTime.now());
        testRun2.setUpdatedAt(LocalDateTime.now());

        phase = new VersionPhaseEntity();
        phase.setId(1L);
        phase.setVersion(version);
        phase.setPhaseName("Regression");
        phase.setOrderIndex(1);
    }

    @Test
    void testAddPhase_Success() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Regression", List.of(1L), null, null, null, null);

        VersionPhaseTestRunEntity junction = new VersionPhaseTestRunEntity();
        junction.setId(1L);
        junction.setVersionPhase(phase);
        junction.setTestRun(testRun1);

        when(versionRepository.findById(1L)).thenReturn(Optional.of(version));
        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun1));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(versionPhaseRepository.save(any())).thenReturn(phase);
        when(versionPhaseTestRunRepository.save(any())).thenReturn(junction);
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of(junction));
        when(testRunTestCaseRepository.findAllByTestRunId(1L)).thenReturn(List.of());
        when(testResultRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of());
        when(testResultService.computePhaseProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionPhaseDto result = service.addPhase(1L, request);

        // Then
        assertNotNull(result);
        assertEquals("Regression", result.phaseName());
        assertNotNull(result.testRuns());
        assertEquals(1, result.testRuns().size());
        assertEquals(1L, result.testRuns().get(0).testRunId());
        assertEquals("Regression", result.testRuns().get(0).testRunName());
        verify(versionRepository).findById(1L);
        verify(testRunRepository).findById(1L);
        verify(versionPhaseRepository).save(any());
        verify(versionPhaseTestRunRepository).save(any());
        verify(testResultService).createInitialResults(eq(1L), eq(1L), eq(List.of(1L)), isNull());
    }

    @Test
    void testAddPhase_MultipleTestRuns() {
        // Given — 2 test runs assigned to one phase
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Full Regression", List.of(1L, 2L), null, null, null, null);

        VersionPhaseTestRunEntity junction1 = new VersionPhaseTestRunEntity();
        junction1.setId(1L);
        junction1.setVersionPhase(phase);
        junction1.setTestRun(testRun1);

        VersionPhaseTestRunEntity junction2 = new VersionPhaseTestRunEntity();
        junction2.setId(2L);
        junction2.setVersionPhase(phase);
        junction2.setTestRun(testRun2);

        when(versionRepository.findById(1L)).thenReturn(Optional.of(version));
        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun1));
        when(testRunRepository.findById(2L)).thenReturn(Optional.of(testRun2));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(versionPhaseRepository.save(any())).thenReturn(phase);
        when(versionPhaseTestRunRepository.save(any())).thenReturn(junction1);
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of(junction1, junction2));
        when(testRunTestCaseRepository.findAllByTestRunId(1L)).thenReturn(List.of());
        when(testRunTestCaseRepository.findAllByTestRunId(2L)).thenReturn(List.of());
        when(testResultRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of());
        when(testResultService.computePhaseProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionPhaseDto result = service.addPhase(1L, request);

        // Then
        assertNotNull(result);
        assertEquals(2, result.testRuns().size());
        assertEquals(0, result.totalTestCaseCount());
        verify(versionPhaseTestRunRepository, times(2)).save(any());
        verify(testResultService).createInitialResults(eq(1L), eq(1L), eq(List.of(1L, 2L)), isNull());
    }

    @Test
    void testAddPhase_VersionNotFound() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Phase", List.of(1L), null, null, null, null);

        when(versionRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.addPhase(999L, request));
        verify(versionPhaseRepository, never()).save(any());
    }

    @Test
    void testAddPhase_TestRunNotFound() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Phase", List.of(999L), null, null, null, null);

        when(versionRepository.findById(1L)).thenReturn(Optional.of(version));
        when(testRunRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.addPhase(1L, request));
        verify(versionPhaseRepository, never()).save(any());
    }

    @Test
    void testUpdatePhase_ChangeTestRuns() {
        // Given — replace test runs: [1] -> [2]
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Regression", List.of(2L), null, null, null, null);

        VersionPhaseTestRunEntity newJunction = new VersionPhaseTestRunEntity();
        newJunction.setId(2L);
        newJunction.setVersionPhase(phase);
        newJunction.setTestRun(testRun2);

        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase));
        when(testRunRepository.findById(2L)).thenReturn(Optional.of(testRun2));
        when(versionPhaseRepository.save(any())).thenReturn(phase);
        when(versionPhaseTestRunRepository.save(any())).thenReturn(newJunction);
        when(versionPhaseTestRunRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of(newJunction));
        when(testRunTestCaseRepository.findAllByTestRunId(2L)).thenReturn(List.of());
        when(testResultRepository.findAllByVersionPhaseId(1L)).thenReturn(List.of());
        when(testResultService.computePhaseProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionPhaseDto result = service.updatePhase(1L, request);

        // Then
        assertNotNull(result);
        assertEquals(1, result.testRuns().size());
        assertEquals(2L, result.testRuns().get(0).testRunId());
        verify(versionPhaseTestRunRepository).deleteAllByVersionPhaseId(1L);
        verify(testRunRepository).findById(2L);
        verify(versionPhaseTestRunRepository).save(any());
        verify(versionPhaseRepository).save(any());
    }

    @Test
    void testUpdatePhase_PhaseNotFound() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Phase", List.of(1L), null, null, null, null);

        when(versionPhaseRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.updatePhase(999L, request));
        verify(versionPhaseRepository, never()).save(any());
    }

    @Test
    void testDeletePhase_Success() {
        // Given
        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());

        // When
        service.deletePhase(1L);

        // Then
        verify(versionPhaseRepository).findById(1L);
        verify(versionPhaseRepository).delete(phase);
    }

    @Test
    void testDeletePhase_NotFound() {
        // Given
        when(versionPhaseRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.deletePhase(999L));
        verify(versionPhaseRepository, never()).delete(any());
    }

    @Test
    void testReorderPhase_UpdateOrderIndex() {
        // Given
        VersionPhaseEntity phase1 = new VersionPhaseEntity();
        phase1.setId(1L);
        phase1.setVersion(version);
        phase1.setPhaseName("Phase 1");
        phase1.setOrderIndex(1);

        VersionPhaseEntity phase2 = new VersionPhaseEntity();
        phase2.setId(2L);
        phase2.setVersion(version);
        phase2.setPhaseName("Phase 2");
        phase2.setOrderIndex(2);

        VersionPhaseEntity phase3 = new VersionPhaseEntity();
        phase3.setId(3L);
        phase3.setVersion(version);
        phase3.setPhaseName("Phase 3");
        phase3.setOrderIndex(3);

        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase1));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L))
                .thenReturn(List.of(phase1, phase2, phase3));
        when(versionPhaseRepository.save(any())).thenReturn(phase1);

        // When - Move phase1 from position 1 to position 3
        service.reorderPhase(1L, 3);

        // Then
        verify(versionPhaseRepository).findById(1L);
        verify(versionPhaseRepository).findAllByVersionIdOrderByOrderIndex(1L);
        // Should save at least the phase being moved
        verify(versionPhaseRepository, atLeastOnce()).save(any());
    }

    @Test
    void testReorderPhase_NoChangeNeeded() {
        // Given
        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of(phase));

        // When - Move to same position
        service.reorderPhase(1L, 1);

        // Then
        verify(versionPhaseRepository).findById(1L);
        // Should return early if no change needed, so no save calls
        verify(versionPhaseRepository, never()).save(any());
    }

    @Test
    void testReorderPhase_PhaseNotFound() {
        // Given
        when(versionPhaseRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.reorderPhase(999L, 2));
        verify(versionPhaseRepository, never()).findAllByVersionIdOrderByOrderIndex(any());
    }

    @Test
    void testAddTestCasesToPhase_CreatesJunctionAndResult() {
        // Given
        TestCaseEntity tc1 = new TestCaseEntity();
        tc1.setId(10L);
        tc1.setTitle("TC 10");
        TestCaseEntity tc2 = new TestCaseEntity();
        tc2.setId(20L);
        tc2.setTitle("TC 20");

        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase));
        when(testCaseRepository.findById(10L)).thenReturn(Optional.of(tc1));
        when(testCaseRepository.findById(20L)).thenReturn(Optional.of(tc2));

        // When
        service.addTestCasesToPhase(1L, 1L, List.of(10L, 20L));

        // Then
        verify(versionPhaseTestCaseRepository, times(2)).save(any(VersionPhaseTestCaseEntity.class));
        verify(testResultService).createResultForTestCase(1L, 1L, 10L);
        verify(testResultService).createResultForTestCase(1L, 1L, 20L);
    }

    @Test
    void testAddTestCasesToPhase_PhaseNotFound() {
        // Given
        when(versionPhaseRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class,
                () -> service.addTestCasesToPhase(1L, 999L, List.of(10L)));
        verify(versionPhaseTestCaseRepository, never()).save(any());
    }

    @Test
    void testAddTestCasesToPhase_TestCaseNotFound() {
        // Given
        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase));
        when(testCaseRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class,
                () -> service.addTestCasesToPhase(1L, 1L, List.of(999L)));
    }

    @Test
    void testRemoveTestCasesFromPhase_DeletesJunctionAndResult() {
        // When
        service.removeTestCasesFromPhase(1L, List.of(10L, 20L));

        // Then
        verify(versionPhaseTestCaseRepository).deleteByVersionPhaseIdAndTestCaseId(1L, 10L);
        verify(versionPhaseTestCaseRepository).deleteByVersionPhaseIdAndTestCaseId(1L, 20L);
        verify(testResultRepository).deleteByVersionPhaseIdAndTestCaseId(1L, 10L);
        verify(testResultRepository).deleteByVersionPhaseIdAndTestCaseId(1L, 20L);
    }
}
