package com.myqaweb.common;

import com.myqaweb.monitoring.AiFeature;
import com.myqaweb.monitoring.AiUsageLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Shared service for generating text embeddings via OpenAI text-embedding-3-small.
 * Used by FAQ and Knowledge Base services for RAG vector search.
 * EmbeddingModel is optional - if not available (e.g., OpenAI API key not set), embed() will throw an exception.
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);
    private static final String PROVIDER = "OPENAI";
    private static final String MODEL = "text-embedding-3-small";

    private final Optional<EmbeddingModel> embeddingModel;
    private final AiUsageLogService aiUsageLogService;

    public EmbeddingService(Optional<EmbeddingModel> embeddingModel,
                            AiUsageLogService aiUsageLogService) {
        this.embeddingModel = embeddingModel;
        this.aiUsageLogService = aiUsageLogService;
        if (embeddingModel.isPresent()) {
            log.info("EmbeddingService initialized with OpenAI EmbeddingModel");
        } else {
            log.warn("EmbeddingService initialized without EmbeddingModel - embedding operations will fail");
        }
    }

    /**
     * Generates an embedding vector for the given text (without feature tracking).
     *
     * @param text the text to embed
     * @return embedding as float array (1536 dimensions)
     * @throws IllegalStateException if EmbeddingModel is not available
     */
    public float[] embed(String text) {
        return embed(text, null);
    }

    /**
     * Generates an embedding vector for the given text with feature tracking.
     *
     * @param text    the text to embed
     * @param feature the feature that triggered this embedding (for usage tracking)
     * @return embedding as float array (1536 dimensions)
     * @throws IllegalStateException if EmbeddingModel is not available
     */
    public float[] embed(String text, AiFeature feature) {
        if (embeddingModel.isEmpty()) {
            throw new IllegalStateException("EmbeddingModel is not available - OpenAI API key may not be configured");
        }

        long startMs = System.currentTimeMillis();
        try {
            EmbeddingResponse response = embeddingModel.get().embedForResponse(List.of(text));
            long durationMs = System.currentTimeMillis() - startMs;

            List<Double> output = response.getResult().getOutput();
            float[] result = new float[output.size()];
            for (int i = 0; i < output.size(); i++) {
                result[i] = output.get(i).floatValue();
            }

            // Log usage if feature tracking is enabled
            if (feature != null) {
                Integer inputTokens = extractEmbeddingTokens(response);
                aiUsageLogService.logUsage(feature, PROVIDER, MODEL,
                        inputTokens, null, durationMs, true, null);
            }

            return result;
        } catch (Exception e) {
            long durationMs = System.currentTimeMillis() - startMs;
            if (feature != null) {
                aiUsageLogService.logUsage(feature, PROVIDER, MODEL,
                        null, null, durationMs, false, e.getMessage());
            }
            throw e;
        }
    }

    /**
     * Converts a float array embedding to a pgvector-compatible string representation.
     * Example: [0.1, 0.2, 0.3] -> "[0.1,0.2,0.3]"
     *
     * @param embedding the embedding vector
     * @return string representation for pgvector queries
     */
    public String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    private Integer extractEmbeddingTokens(EmbeddingResponse response) {
        try {
            if (response.getMetadata() != null) {
                // Spring AI 1.0.0-M1 EmbeddingResponseMetadata doesn't expose getUsage() directly.
                // Estimate tokens from text length as fallback.
                return null;
            }
        } catch (Exception e) {
            log.debug("Could not extract embedding token count: {}", e.getMessage());
        }
        return null;
    }
}
