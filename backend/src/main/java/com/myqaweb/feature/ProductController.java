package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Product endpoints.
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;

    /**
     * GET /api/products?companyId={id} - List products by company.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDto.ProductResponse>>> listByCompany(
            @RequestParam Long companyId) {
        List<ProductDto.ProductResponse> products = productService.findByCompanyId(companyId);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    /**
     * POST /api/products - Create a new product.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ProductDto.ProductResponse>> create(
            @Valid @RequestBody ProductDto.ProductRequest request) {
        ProductDto.ProductResponse product = productService.save(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Product created successfully", product));
    }

    /**
     * PUT /api/products/{id} - Update a product.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDto.ProductResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody ProductDto.ProductRequest request) {
        ProductDto.ProductResponse product = productService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Product updated successfully", product));
    }

    /**
     * DELETE /api/products/{id} - Delete a product.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        productService.delete(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Product deleted successfully", null));
    }
}
