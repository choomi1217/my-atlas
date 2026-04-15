package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for VersionPhaseTestRun junction entity.
 */
@Repository
public interface VersionPhaseTestRunRepository extends JpaRepository<VersionPhaseTestRunEntity, Long> {
    List<VersionPhaseTestRunEntity> findAllByVersionPhaseId(Long versionPhaseId);

    @Modifying
    @Query("DELETE FROM VersionPhaseTestRunEntity e WHERE e.versionPhase.id = :versionPhaseId")
    void deleteAllByVersionPhaseId(Long versionPhaseId);
}
