package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for TestResult entity.
 */
@Repository
public interface TestResultRepository extends JpaRepository<TestResultEntity, Long> {
    List<TestResultEntity> findAllByVersionPhaseId(Long versionPhaseId);

    Optional<TestResultEntity> findByVersionPhaseIdAndTestCaseId(Long versionPhaseId, Long testCaseId);

    List<TestResultEntity> findAllByVersionId(Long versionId);

    List<TestResultEntity> findAllByVersionIdAndStatus(Long versionId, RunResultStatus status);

    @Modifying
    @Query("DELETE FROM TestResultEntity e WHERE e.versionPhase.id = :phaseId AND e.testCase.id = :testCaseId")
    void deleteByVersionPhaseIdAndTestCaseId(@Param("phaseId") Long phaseId, @Param("testCaseId") Long testCaseId);

    @Modifying
    @Query(value = "DELETE FROM test_result WHERE version_phase_id IN " +
            "(SELECT version_phase_id FROM version_phase_test_run WHERE test_run_id = :testRunId)",
            nativeQuery = true)
    void deleteByTestRunIdViaPhase(@Param("testRunId") Long testRunId);
}
