package com.myqaweb.feature;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for Company operations.
 */
public interface CompanyService {
    /**
     * Get all companies.
     *
     * @return list of companies
     */
    List<CompanyDto.CompanyResponse> findAll();

    /**
     * Get a company by ID.
     *
     * @param id the company ID
     * @return the company, or empty if not found
     */
    Optional<CompanyDto.CompanyResponse> findById(Long id);

    /**
     * Create a new company.
     *
     * @param request the company request
     * @return the created company
     */
    CompanyDto.CompanyResponse save(CompanyDto.CompanyRequest request);

    /**
     * Set a company as active (and deactivate the previous active company).
     *
     * @param id the company ID to activate
     * @return the activated company
     */
    CompanyDto.CompanyResponse setActive(Long id);

    /**
     * Update a company's name.
     *
     * @param id the company ID
     * @param request the update request
     * @return the updated company
     */
    CompanyDto.CompanyResponse update(Long id, CompanyDto.CompanyRequest request);

    /**
     * Deactivate a company (set is_active to false).
     *
     * @param id the company ID
     * @return the deactivated company
     */
    CompanyDto.CompanyResponse deactivate(Long id);

    /**
     * Delete a company.
     *
     * @param id the company ID
     */
    void delete(Long id);
}
