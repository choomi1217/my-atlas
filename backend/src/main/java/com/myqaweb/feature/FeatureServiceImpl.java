package com.myqaweb.feature;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Implementation of FeatureService with embedding support.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class FeatureServiceImpl implements FeatureService {
    private final FeatureRepository featureRepository;
    private final ProductRepository productRepository;
    private final EmbeddingModel embeddingModel;

    @Value("${feature.embedding.enabled:false}")
    private boolean embeddingEnabled;

    @Override
    @Transactional(readOnly = true)
    public List<FeatureDto.FeatureResponse> findByProductId(Long productId) {
        return featureRepository.findAllByProductId(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FeatureDto.FeatureResponse> findById(Long id) {
        return featureRepository.findById(id).map(this::toResponse);
    }

    @Override
    public FeatureDto.FeatureResponse saveWithEmbedding(FeatureDto.FeatureRequest request) {
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + request.productId()));

        FeatureEntity entity = new FeatureEntity();
        entity.setProduct(product);
        entity.setPath(request.path());
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setPromptText(request.promptText());

        // Generate embedding
        String textToEmbed = (request.description() != null ? request.description() : "") + " " +
                             (request.promptText() != null ? request.promptText() : "");
        float[] embedding = generateEmbedding(textToEmbed.trim());
        entity.setEmbedding(embedding);

        FeatureEntity saved = featureRepository.save(entity);
        return toResponse(saved);
    }

    @Override
    public FeatureDto.FeatureResponse update(Long id, FeatureDto.FeatureRequest request) {
        FeatureEntity entity = featureRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Feature not found: " + id));

        entity.setPath(request.path());
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setPromptText(request.promptText());

        // Regenerate embedding
        String textToEmbed = (request.description() != null ? request.description() : "") + " " +
                             (request.promptText() != null ? request.promptText() : "");
        float[] embedding = generateEmbedding(textToEmbed.trim());
        entity.setEmbedding(embedding);

        FeatureEntity updated = featureRepository.save(entity);
        return toResponse(updated);
    }

    @Override
    public void delete(Long id) {
        featureRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FeatureDto.FeatureResponse> searchSimilar(String query, int topK) {
        // Note: Embedding similarity search is not yet implemented
        // This requires pgvector integration or Spring AI VectorStore
        // For now, return all features as placeholder
        log.info("Search similar feature by query: {}", query);
        return List.of();
    }

    private float[] generateEmbedding(String text) {
        // Return zero vector if embedding is disabled (for E2E tests, etc.)
        if (!embeddingEnabled) {
            log.info("Embedding generation is disabled, using zero vector");
            return new float[1536];
        }

        try {
            List<Double> output = embeddingModel
                    .call(new EmbeddingRequest(List.of(text), EmbeddingOptions.EMPTY))
                    .getResult().getOutput();

            float[] embedding = new float[output.size()];
            for (int i = 0; i < output.size(); i++) {
                embedding[i] = output.get(i).floatValue();
            }
            return embedding;
        } catch (Exception e) {
            log.error("Failed to generate embedding for text: {}", text, e);
            // Return zero vector on failure
            return new float[1536];
        }
    }

    private FeatureDto.FeatureResponse toResponse(FeatureEntity entity) {
        return new FeatureDto.FeatureResponse(
                entity.getId(),
                entity.getProduct().getId(),
                entity.getPath(),
                entity.getName(),
                entity.getDescription(),
                entity.getPromptText(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
