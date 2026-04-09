package com.myqaweb.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Implementation of CompanyService.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class CompanyServiceImpl implements CompanyService {
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CompanyDto.CompanyResponse> findAll() {
        return companyRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CompanyDto.CompanyResponse> findById(Long id) {
        return companyRepository.findById(id).map(this::toResponse);
    }

    @Override
    public CompanyDto.CompanyResponse save(CompanyDto.CompanyRequest request) {
        CompanyEntity entity = new CompanyEntity();
        entity.setName(request.name());
        entity.setIsActive(false);
        CompanyEntity saved = companyRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public CompanyDto.CompanyResponse setActive(Long id) {
        // Deactivate the current active company
        companyRepository.findByIsActiveTrue()
                .ifPresent(company -> {
                    company.setIsActive(false);
                    companyRepository.save(company);
                });

        // Activate the target company
        CompanyEntity entity = companyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + id));
        entity.setIsActive(true);
        CompanyEntity updated = companyRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public CompanyDto.CompanyResponse update(Long id, CompanyDto.CompanyRequest request) {
        CompanyEntity entity = companyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + id));
        entity.setName(request.name());
        CompanyEntity updated = companyRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public CompanyDto.CompanyResponse deactivate(Long id) {
        CompanyEntity entity = companyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + id));
        entity.setIsActive(false);
        CompanyEntity updated = companyRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        companyRepository.deleteById(id);
    }

    private CompanyDto.CompanyResponse toResponse(CompanyEntity entity) {
        int productCount = productRepository.countByCompanyId(entity.getId());
        return new CompanyDto.CompanyResponse(
                entity.getId(),
                entity.getName(),
                entity.getIsActive(),
                productCount,
                entity.getCreatedAt()
        );
    }
}
