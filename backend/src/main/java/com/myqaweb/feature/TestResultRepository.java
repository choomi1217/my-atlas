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

    @Modifying
    @Query("DELETE FROM TestResultEntity tr WHERE tr.versionPhase.testRun.id = :testRunId")
    void deleteByTestRunIdViaPhase(@Param("testRunId") Long testRunId);
}
