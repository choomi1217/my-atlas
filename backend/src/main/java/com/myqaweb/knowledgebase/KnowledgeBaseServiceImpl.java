package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class KnowledgeBaseServiceImpl implements KnowledgeBaseService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseServiceImpl.class);
    private static final int MAX_PINNED = 15;
    private static final int HIT_TOP_K = 5;

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KbCategoryService categoryService;
    private final EmbeddingService embeddingService;

    @Override
    @Transactional(readOnly = true)
    public List<KnowledgeBaseDto.KbResponse> findAll(String search, String sort) {
        List<KnowledgeBaseEntity> entities;
        String effectiveSort = (sort == null || sort.isBlank()) ? "newest" : sort;

        entities = switch (effectiveSort) {
            case "oldest" -> knowledgeBaseRepository.findActiveBySearchOldest(search);
            case "title" -> knowledgeBaseRepository.findActiveBySearchTitle(search);
            default -> knowledgeBaseRepository.findActiveBySearchNewest(search);
        };

        return entities.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<KnowledgeBaseDto.KbResponse> findById(Long id) {
        return knowledgeBaseRepository.findActiveById(id)
                .map(this::toResponse);
    }

    @Override
    public KnowledgeBaseDto.KbResponse create(KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setTitle(request.title());
        entity.setContent(request.content());
        entity.setCategory(request.category());

        // Auto-register category for autocomplete
        categoryService.ensureExists(request.category());

        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        scheduleEmbeddingGeneration(saved.getId(), saved.getTitle(), saved.getContent());

        return toResponse(saved);
    }

    @Override
    public KnowledgeBaseDto.KbResponse update(Long id, KnowledgeBaseDto.KbRequest request) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findActiveById(id)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge Base entry not found: " + id));

        entity.setTitle(request.title());
        entity.setContent(request.content());
        entity.setCategory(request.category());

        // Auto-register category for autocomplete
        categoryService.ensureExists(request.category());

        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        scheduleEmbeddingGeneration(saved.getId(), saved.getTitle(), saved.getContent());

        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge Base entry not found: " + id));

        if (entity.getSource() != null) {
            // PDF 항목 → Soft Delete (원본 보존)
            knowledgeBaseRepository.softDelete(id, LocalDateTime.now());
        } else {
            // 수동 항목 → Hard Delete
            knowledgeBaseRepository.deleteById(id);
        }
    }

    @Override
    public void pinKbEntry(Long id) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findActiveById(id)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge Base entry not found: " + id));

        if (entity.getPinnedAt() != null) {
            throw new IllegalStateException("Entry is already pinned: " + id);
        }

        long pinnedCount = knowledgeBaseRepository.countByPinnedAtIsNotNull();
        if (pinnedCount >= MAX_PINNED) {
            throw new IllegalStateException("Maximum " + MAX_PINNED + " pinned entries reached");
        }

        knowledgeBaseRepository.updatePinnedAt(id, LocalDateTime.now());
    }

    @Override
    public void unpinKbEntry(Long id) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findActiveById(id)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge Base entry not found: " + id));

        if (entity.getPinnedAt() == null) {
            throw new IllegalStateException("Entry is not pinned: " + id);
        }

        knowledgeBaseRepository.updatePinnedAt(id, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<KnowledgeBaseDto.KbResponse> getCuratedFaqs() {
        // 1. Pinned entries (up to 15, ordered by pin time)
        List<KnowledgeBaseEntity> pinned = knowledgeBaseRepository.findPinned();
        Set<Long> pinnedIds = pinned.stream()
                .map(KnowledgeBaseEntity::getId)
                .collect(Collectors.toSet());

        // 2. Top hit entries (fetch extra to account for overlap with pinned)
        List<KnowledgeBaseEntity> topHits = knowledgeBaseRepository
                .findTopByHitCount(HIT_TOP_K + pinnedIds.size());

        // 3. Filter out pinned duplicates, take top 5
        List<KnowledgeBaseEntity> hitOnly = topHits.stream()
                .filter(kb -> !pinnedIds.contains(kb.getId()))
                .filter(kb -> kb.getHitCount() > 0)
                .limit(HIT_TOP_K)
                .collect(Collectors.toList());

        // 4. Combine: pinned first, then hits
        List<KnowledgeBaseDto.KbResponse> result = new ArrayList<>();
        pinned.forEach(kb -> result.add(toResponse(kb)));
        hitOnly.forEach(kb -> result.add(toResponse(kb)));

        return result;
    }

    private void scheduleEmbeddingGeneration(Long entityId, String title, String content) {
        Thread.startVirtualThread(() -> {
            try {
                String text = title + " " + stripMarkdown(content);
                float[] embedding = embeddingService.embed(text);
                String vectorStr = embeddingService.toVectorString(embedding);
                knowledgeBaseRepository.updateEmbedding(entityId, vectorStr);
            } catch (Exception e) {
                log.warn("Failed to generate embedding for KB id={}", entityId, e);
            }
        });
    }

    static String stripMarkdown(String md) {
        if (md == null || md.isBlank()) return "";
        return md
                .replaceAll("```[\\s\\S]*?```", " ")
                .replaceAll("`[^`]*`", " ")
                .replaceAll("!\\[([^]]*)]\\([^)]*\\)", "$1")
                .replaceAll("\\[([^]]*)]\\([^)]*\\)", "$1")
                .replaceAll("^#{1,6}\\s+", "")
                .replaceAll("(\\*{1,3}|_{1,3})", "")
                .replaceAll("^>\\s?", "")
                .replaceAll("^[-*+]\\s+", "")
                .replaceAll("^\\d+\\.\\s+", "")
                .replaceAll("---+|===+|\\*\\*\\*+", "")
                .replaceAll("~{2}[^~]*~{2}", "")
                .replaceAll("\\n{2,}", "\n")
                .trim();
    }

    KnowledgeBaseDto.KbResponse toResponse(KnowledgeBaseEntity entity) {
        return new KnowledgeBaseDto.KbResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getContent(),
                entity.getCategory(),
                entity.getSource(),
                entity.getHitCount(),
                entity.getPinnedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getDeletedAt()
        );
    }
}
