package com.myqaweb.feature;

import java.util.List;

/**
 * Service interface for TestResult operations.
 */
public interface TestResultService {
    /**
     * Create initial test results (UNTESTED) for all test cases in a test run.
     * Called when a VersionPhase is created.
     *
     * @param versionId the version ID
     * @param phaseId the phase ID
     * @param testRunId the test run ID
     */
    void createInitialResults(Long versionId, Long phaseId, Long testRunId);

    /**
     * Create initial test results for multiple test runs (1:N Phase:TestRun).
     * Deduplicates test cases that appear in multiple runs.
     */
    void createInitialResults(Long versionId, Long phaseId, List<Long> testRunIds);

    /**
     * Get all results for a version (Option A: total progress).
     */
    List<TestResultEntity> getAllByVersionId(Long versionId);

    /**
     * Get all results for a version phase (Option B: phase-specific progress).
     */
    List<TestResultEntity> getAllByVersionPhaseId(Long versionPhaseId);

    /**
     * Update test result status and comment.
     */
    TestResultEntity updateResult(Long resultId, RunResultStatus status, String comment);

    /**
     * Compute progress stats (Option A: Version-level).
     */
    VersionDto.ProgressStats computeVersionProgress(Long versionId);

    /**
     * Compute progress stats (Option B: Phase-level).
     */
    VersionDto.ProgressStats computePhaseProgress(Long versionPhaseId);
}
