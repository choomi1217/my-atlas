package com.myqaweb.feature;

import java.util.List;

/**
 * Service interface for VersionPhase operations.
 */
public interface VersionPhaseService {
    /**
     * Add a phase to a version.
     */
    VersionDto.VersionPhaseDto addPhase(Long versionId, VersionDto.PhaseRequest request);

    /**
     * Get all phases for a version.
     */
    List<VersionDto.VersionPhaseDto> getAllByVersionId(Long versionId);

    /**
     * Update a phase.
     */
    VersionDto.VersionPhaseDto updatePhase(Long phaseId, VersionDto.PhaseRequest request);

    /**
     * Delete a phase and reorder remaining phases.
     */
    void deletePhase(Long versionId, Long phaseId);

    /**
     * Reorder phases with automatic shifting.
     */
    void reorderPhase(Long versionId, Long phaseId, int newOrderIndex);

    /**
     * Delete a phase (legacy method).
     */
    void deletePhase(Long phaseId);

    /**
     * Reorder phases (legacy method).
     */
    void reorderPhase(Long phaseId, Integer newOrderIndex);

    /**
     * Add individual test cases to a phase (creates TestResults).
     */
    void addTestCasesToPhase(Long versionId, Long phaseId, List<Long> testCaseIds);

    /**
     * Remove individual test cases from a phase (deletes TestResults).
     */
    void removeTestCasesFromPhase(Long phaseId, List<Long> testCaseIds);
}
