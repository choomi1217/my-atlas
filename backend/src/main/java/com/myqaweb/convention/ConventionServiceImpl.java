package com.myqaweb.convention;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ConventionServiceImpl implements ConventionService {

    private final ConventionRepository conventionRepository;
    private final WordCategoryService wordCategoryService;

    @Override
    @Transactional(readOnly = true)
    public List<ConventionDto.ConventionResponse> findAll() {
        return conventionRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ConventionDto.ConventionResponse> findById(Long id) {
        return conventionRepository.findById(id)
                .map(this::toResponse);
    }

    @Override
    public ConventionDto.ConventionResponse create(ConventionDto.ConventionRequest request) {
        ConventionEntity entity = new ConventionEntity();
        entity.setTerm(request.term());
        entity.setDefinition(request.definition());
        entity.setCategory(request.category());
        entity.setImageUrl(request.imageUrl());
        entity.setUpdatedAt(LocalDateTime.now());
        wordCategoryService.ensureExists(request.category());

        ConventionEntity saved = conventionRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public ConventionDto.ConventionResponse update(Long id, ConventionDto.ConventionRequest request) {
        ConventionEntity entity = conventionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Convention not found: " + id));

        entity.setTerm(request.term());
        entity.setDefinition(request.definition());
        entity.setCategory(request.category());
        entity.setImageUrl(request.imageUrl());
        entity.setUpdatedAt(LocalDateTime.now());
        wordCategoryService.ensureExists(request.category());

        ConventionEntity saved = conventionRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        if (!conventionRepository.existsById(id)) {
            throw new IllegalArgumentException("Convention not found: " + id);
        }
        conventionRepository.deleteById(id);
    }

    private ConventionDto.ConventionResponse toResponse(ConventionEntity entity) {
        return new ConventionDto.ConventionResponse(
                entity.getId(),
                entity.getTerm(),
                entity.getDefinition(),
                entity.getCategory(),
                entity.getImageUrl(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
