package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class KnowledgeBaseServiceImpl implements KnowledgeBaseService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseServiceImpl.class);

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final EmbeddingService embeddingService;

    @Override
    @Transactional(readOnly = true)
    public List<KnowledgeBaseDto.KbResponse> findAll() {
        return knowledgeBaseRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<KnowledgeBaseDto.KbResponse> findById(Long id) {
        return knowledgeBaseRepository.findById(id)
                .map(this::toResponse);
    }

    @Override
    public KnowledgeBaseDto.KbResponse create(KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setTitle(request.title());
        entity.setContent(request.content());
        entity.setCategory(request.category());
        entity.setTags(request.tags());

        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        scheduleEmbeddingGeneration(saved.getId(), saved.getTitle(), saved.getContent());

        return toResponse(saved);
    }

    @Override
    public KnowledgeBaseDto.KbResponse update(Long id, KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge Base entry not found: " + id));

        entity.setTitle(request.title());
        entity.setContent(request.content());
        entity.setCategory(request.category());
        entity.setTags(request.tags());

        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        scheduleEmbeddingGeneration(saved.getId(), saved.getTitle(), saved.getContent());

        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        if (!knowledgeBaseRepository.existsById(id)) {
            throw new IllegalArgumentException("Knowledge Base entry not found: " + id);
        }
        knowledgeBaseRepository.deleteById(id);
    }

    private void scheduleEmbeddingGeneration(Long entityId, String title, String content) {
        Thread.startVirtualThread(() -> {
            try {
                String text = title + " " + content;
                float[] embedding = embeddingService.embed(text);
                knowledgeBaseRepository.findById(entityId).ifPresent(entity -> {
                    entity.setEmbedding(embedding);
                    knowledgeBaseRepository.save(entity);
                });
            } catch (Exception e) {
                log.warn("Failed to generate embedding for KB id={}", entityId, e);
            }
        });
    }

    private KnowledgeBaseDto.KbResponse toResponse(KnowledgeBaseEntity entity) {
        return new KnowledgeBaseDto.KbResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getContent(),
                entity.getCategory(),
                entity.getTags(),
                entity.getSource(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
