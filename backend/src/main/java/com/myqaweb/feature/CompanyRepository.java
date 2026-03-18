package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for Company entity.
 */
@Repository
public interface CompanyRepository extends JpaRepository<CompanyEntity, Long> {
    /**
     * Find the active company.
     *
     * @return Optional containing the active company, empty if none
     */
    Optional<CompanyEntity> findByIsActiveTrue();
}
