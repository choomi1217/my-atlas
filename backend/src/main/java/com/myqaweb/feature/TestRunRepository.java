package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for TestRun entity.
 */
@Repository
public interface TestRunRepository extends JpaRepository<TestRunEntity, Long> {
    List<TestRunEntity> findAllByProductIdOrderByCreatedAtDesc(Long productId);

    Optional<TestRunEntity> findByProductIdAndName(Long productId, String name);
}
