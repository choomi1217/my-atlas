package com.myqaweb.knowledgebase;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class KbCategoryServiceImpl implements KbCategoryService {

    private final KbCategoryRepository categoryRepository;

    @Override
    @Transactional(readOnly = true)
    public List<KbCategoryDto.CategoryResponse> findAll() {
        return categoryRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<KbCategoryDto.CategoryResponse> search(String query) {
        if (query == null || query.isBlank()) {
            return findAll();
        }
        return categoryRepository.findByNameContainingIgnoreCaseOrderByNameAsc(query).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public KbCategoryDto.CategoryResponse create(String name) {
        if (categoryRepository.existsByName(name.trim())) {
            throw new IllegalStateException("Category already exists: " + name);
        }
        KbCategoryEntity entity = new KbCategoryEntity();
        entity.setName(name.trim());
        return toResponse(categoryRepository.save(entity));
    }

    @Override
    public void ensureExists(String name) {
        if (name == null || name.isBlank()) return;
        String trimmed = name.trim();
        if (!categoryRepository.existsByName(trimmed)) {
            KbCategoryEntity entity = new KbCategoryEntity();
            entity.setName(trimmed);
            categoryRepository.save(entity);
        }
    }

    private KbCategoryDto.CategoryResponse toResponse(KbCategoryEntity entity) {
        return new KbCategoryDto.CategoryResponse(entity.getId(), entity.getName(), entity.getCreatedAt());
    }
}
