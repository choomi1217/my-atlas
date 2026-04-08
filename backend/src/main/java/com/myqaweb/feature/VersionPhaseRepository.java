package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for VersionPhase entity.
 */
@Repository
public interface VersionPhaseRepository extends JpaRepository<VersionPhaseEntity, Long> {
    List<VersionPhaseEntity> findAllByVersionIdOrderByOrderIndex(Long versionId);

    List<VersionPhaseEntity> findByVersionIdAndOrderIndexGreaterThan(Long versionId, int orderIndex);

    List<VersionPhaseEntity> findByVersionIdAndOrderIndexGreaterThanEqual(Long versionId, int orderIndex);
}
