package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository for Version entity.
 */
@Repository
public interface VersionRepository extends JpaRepository<VersionEntity, Long> {
    List<VersionEntity> findAllByProductIdOrderByReleaseDateDescCreatedAtDesc(Long productId);

    Optional<VersionEntity> findByProductIdAndName(Long productId, String name);

    List<VersionEntity> findAllByReleaseDateBefore(LocalDate date);
}
