package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCaseEntity, Long> {
    List<TestCaseEntity> findAllByProductId(Long productId);

    List<TestCaseEntity> findAllByProductIdAndStatus(Long productId, TestStatus status);

    @Query("SELECT tc FROM TestCaseEntity tc WHERE tc.product.company.id = :companyId")
    List<TestCaseEntity> findAllByCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT tc FROM TestCaseEntity tc WHERE tc.product.company.id = :companyId AND tc.status = :status")
    List<TestCaseEntity> findAllByCompanyIdAndStatus(@Param("companyId") Long companyId,
                                                    @Param("status") TestStatus status);

    @Modifying
    @Query("DELETE FROM TestCaseEntity t WHERE t.id = :id")
    void deleteByIdDirectly(@Param("id") Long id);
}
