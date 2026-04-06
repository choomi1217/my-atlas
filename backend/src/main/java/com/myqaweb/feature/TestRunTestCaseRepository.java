package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for TestRunTestCase junction entity.
 */
@Repository
public interface TestRunTestCaseRepository extends JpaRepository<TestRunTestCaseEntity, Long> {
    List<TestRunTestCaseEntity> findAllByTestRunId(Long testRunId);

    @Modifying
    @Query("DELETE FROM TestRunTestCaseEntity t WHERE t.testRun.id = :testRunId")
    void deleteByTestRunId(@Param("testRunId") Long testRunId);
}
