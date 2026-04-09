package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Product entity.
 */
@Repository
public interface ProductRepository extends JpaRepository<ProductEntity, Long> {
    /**
     * Find all products by company ID.
     *
     * @param companyId the company ID
     * @return list of products
     */
    List<ProductEntity> findAllByCompanyId(Long companyId);

    int countByCompanyId(Long companyId);
}
