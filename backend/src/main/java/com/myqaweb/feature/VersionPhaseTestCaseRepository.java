package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for direct Phase-TestCase junction.
 */
@Repository
public interface VersionPhaseTestCaseRepository extends JpaRepository<VersionPhaseTestCaseEntity, Long> {
    List<VersionPhaseTestCaseEntity> findAllByVersionPhaseId(Long versionPhaseId);

    @Modifying
    @Query("DELETE FROM VersionPhaseTestCaseEntity e WHERE e.versionPhase.id = :versionPhaseId AND e.testCase.id = :testCaseId")
    void deleteByVersionPhaseIdAndTestCaseId(Long versionPhaseId, Long testCaseId);

    @Modifying
    @Query("DELETE FROM VersionPhaseTestCaseEntity e WHERE e.versionPhase.id = :versionPhaseId")
    void deleteAllByVersionPhaseId(Long versionPhaseId);
}
