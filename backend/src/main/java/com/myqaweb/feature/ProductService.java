package com.myqaweb.feature;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for Product operations.
 */
public interface ProductService {
    /**
     * Get all products by company ID.
     *
     * @param companyId the company ID
     * @return list of products
     */
    List<ProductDto.ProductResponse> findByCompanyId(Long companyId);

    /**
     * Get a product by ID.
     *
     * @param id the product ID
     * @return the product, or empty if not found
     */
    Optional<ProductDto.ProductResponse> findById(Long id);

    /**
     * Create a new product.
     *
     * @param request the product request
     * @return the created product
     */
    ProductDto.ProductResponse save(ProductDto.ProductRequest request);

    /**
     * Update an existing product.
     *
     * @param id the product ID
     * @param request the product request
     * @return the updated product
     */
    ProductDto.ProductResponse update(Long id, ProductDto.ProductRequest request);

    /**
     * Delete a product.
     *
     * @param id the product ID
     */
    void delete(Long id);
}
