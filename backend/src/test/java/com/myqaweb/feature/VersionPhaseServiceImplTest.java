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
        phase.setTestRun(testRun1);
        phase.setOrderIndex(1);
    }

    @Test
    void testAddPhase_Success() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Regression", 1L);

        when(versionRepository.findById(1L)).thenReturn(Optional.of(version));
        when(testRunRepository.findById(1L)).thenReturn(Optional.of(testRun1));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(1L)).thenReturn(List.of());
        when(versionPhaseRepository.save(any())).thenReturn(phase);
        when(testResultService.computePhaseProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionPhaseDto result = service.addPhase(1L, request);

        // Then
        assertNotNull(result);
        assertEquals("Regression", result.phaseName());
        verify(versionRepository).findById(1L);
        verify(testRunRepository).findById(1L);
        verify(versionPhaseRepository).save(any());
    }

    @Test
    void testAddPhase_VersionNotFound() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Phase", 1L);

        when(versionRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.addPhase(999L, request));
        verify(versionPhaseRepository, never()).save(any());
    }

    @Test
    void testAddPhase_TestRunNotFound() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Phase", 999L);

        when(versionRepository.findById(1L)).thenReturn(Optional.of(version));
        when(testRunRepository.findById(999L)).thenReturn(Optional.empty());

        // When & Then
        assertThrows(EntityNotFoundException.class, () -> service.addPhase(1L, request));
        verify(versionPhaseRepository, never()).save(any());
    }

    @Test
    void testUpdatePhase_ChangeTestRun() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Regression", 2L);

        VersionPhaseEntity updated = new VersionPhaseEntity();
        updated.setId(1L);
        updated.setVersion(version);
        updated.setPhaseName("Regression");
        updated.setTestRun(testRun2); // Changed test run
        updated.setOrderIndex(1);

        when(versionPhaseRepository.findById(1L)).thenReturn(Optional.of(phase));
        when(testRunRepository.findById(2L)).thenReturn(Optional.of(testRun2));
        when(versionPhaseRepository.save(any())).thenReturn(updated);
        when(testResultService.computePhaseProgress(1L))
                .thenReturn(new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0));

        // When
        VersionDto.VersionPhaseDto result = service.updatePhase(1L, request);

        // Then
        assertNotNull(result);
        assertEquals(2L, result.testRunId());
        verify(testRunRepository).findById(2L);
        verify(versionPhaseRepository).save(any());
    }

    @Test
    void testUpdatePhase_PhaseNotFound() {
        // Given
        VersionDto.PhaseRequest request = new VersionDto.PhaseRequest("Phase", 1L);

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
}
