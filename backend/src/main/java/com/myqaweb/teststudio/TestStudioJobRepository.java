package com.myqaweb.teststudio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Test Studio Jobs.
 */
@Repository
public interface TestStudioJobRepository extends JpaRepository<TestStudioJobEntity, Long> {

    /**
     * Find all jobs for a product, newest first.
     */
    List<TestStudioJobEntity> findAllByProductIdOrderByCreatedAtDesc(Long productId);
}
