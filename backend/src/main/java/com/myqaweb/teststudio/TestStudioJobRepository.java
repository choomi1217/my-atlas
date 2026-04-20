package com.myqaweb.teststudio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /**
     * Find every job across every Product within a Company, newest first.
     * Used by the Company-level Test Studio dashboard.
     */
    @Query("SELECT j FROM TestStudioJobEntity j "
            + "WHERE j.productId IN (SELECT p.id FROM ProductEntity p WHERE p.company.id = :companyId) "
            + "ORDER BY j.createdAt DESC")
    List<TestStudioJobEntity> findAllByCompanyIdOrderByCreatedAtDesc(@Param("companyId") Long companyId);
}
