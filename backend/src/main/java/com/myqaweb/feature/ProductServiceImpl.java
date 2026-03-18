package com.myqaweb.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Implementation of ProductService.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ProductServiceImpl implements ProductService {
    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto.ProductResponse> findByCompanyId(Long companyId) {
        return productRepository.findAllByCompanyId(companyId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProductDto.ProductResponse> findById(Long id) {
        return productRepository.findById(id).map(this::toResponse);
    }

    @Override
    public ProductDto.ProductResponse save(ProductDto.ProductRequest request) {
        CompanyEntity company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + request.companyId()));

        ProductEntity entity = new ProductEntity();
        entity.setCompany(company);
        entity.setName(request.name());
        entity.setPlatform(request.platform());
        entity.setDescription(request.description());

        ProductEntity saved = productRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public ProductDto.ProductResponse update(Long id, ProductDto.ProductRequest request) {
        ProductEntity entity = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));

        entity.setName(request.name());
        entity.setPlatform(request.platform());
        entity.setDescription(request.description());

        ProductEntity updated = productRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        productRepository.deleteById(id);
    }

    private ProductDto.ProductResponse toResponse(ProductEntity entity) {
        return new ProductDto.ProductResponse(
                entity.getId(),
                entity.getCompany().getId(),
                entity.getName(),
                entity.getPlatform(),
                entity.getDescription(),
                entity.getCreatedAt()
        );
    }
}
