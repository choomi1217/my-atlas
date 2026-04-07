package com.myqaweb.common;

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

    private final Optional<EmbeddingModel> embeddingModel;

    public EmbeddingService(Optional<EmbeddingModel> embeddingModel) {
        this.embeddingModel = embeddingModel;
        if (embeddingModel.isPresent()) {
            log.info("EmbeddingService initialized with OpenAI EmbeddingModel");
        } else {
            log.warn("EmbeddingService initialized without EmbeddingModel - embedding operations will fail");
        }
    }

    /**
     * Generates an embedding vector for the given text.
     *
     * @param text the text to embed
     * @return embedding as float array (1536 dimensions)
     * @throws IllegalStateException if EmbeddingModel is not available
     */
    public float[] embed(String text) {
        if (embeddingModel.isEmpty()) {
            throw new IllegalStateException("EmbeddingModel is not available - OpenAI API key may not be configured");
        }
        EmbeddingResponse response = embeddingModel.get().embedForResponse(List.of(text));
        List<Double> output = response.getResult().getOutput();
        float[] result = new float[output.size()];
        for (int i = 0; i < output.size(); i++) {
            result[i] = output.get(i).floatValue();
        }
        return result;
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
}
