package com.myqaweb.knowledgebase;

import com.myqaweb.common.BaseIntegrationTest;
import com.myqaweb.common.EmbeddingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for KnowledgeBase vector search using real pgvector database.
 */
@Transactional
class KnowledgeBaseIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private KnowledgeBaseRepository kbRepository;

    @BeforeEach
    void setUp() {
        kbRepository.deleteAll();
    }

    @Test
    void findSimilar_returnsTopKByCosineSimilarity() {
        // Arrange — 5 entries with different embeddings
        float[] target = createEmbedding(1.0f, 0.0f, 0.0f);
        float[] closest = createEmbedding(0.9f, 0.1f, 0.0f);     // most similar to target
        float[] middle = createEmbedding(0.5f, 0.5f, 0.0f);
        float[] far = createEmbedding(0.0f, 1.0f, 0.0f);         // least similar
        float[] farther = createEmbedding(0.0f, 0.0f, 1.0f);

        saveKb("Closest Article", closest);
        saveKb("Middle Article", middle);
        saveKb("Far Article", far);
        saveKb("Farther Article", farther);
        saveKb("Also Close", createEmbedding(0.8f, 0.2f, 0.0f));

        String queryVector = toVectorString(target);

        // Act
        List<KnowledgeBaseEntity> results = kbRepository.findSimilar(queryVector, 3);

        // Assert
        assertEquals(3, results.size());
        assertEquals("Closest Article", results.get(0).getTitle());
    }

    @Test
    void findSimilar_excludesNullEmbeddings() {
        // Arrange
        saveKb("With Embedding", createEmbedding(1.0f, 0.0f, 0.0f));
        KnowledgeBaseEntity noEmbed = new KnowledgeBaseEntity();
        noEmbed.setTitle("No Embedding");
        noEmbed.setContent("Content without embedding");
        kbRepository.save(noEmbed);

        // Act
        List<KnowledgeBaseEntity> results = kbRepository.findSimilar(
                toVectorString(createEmbedding(1.0f, 0.0f, 0.0f)), 10);

        // Assert
        assertEquals(1, results.size());
        assertEquals("With Embedding", results.get(0).getTitle());
    }

    @Test
    void findBySource_returnsOnlyMatchingSource() {
        // Arrange
        KnowledgeBaseEntity pdfEntry = new KnowledgeBaseEntity();
        pdfEntry.setTitle("PDF Chunk");
        pdfEntry.setContent("From PDF");
        pdfEntry.setSource("QA Handbook");
        kbRepository.save(pdfEntry);

        KnowledgeBaseEntity manualEntry = new KnowledgeBaseEntity();
        manualEntry.setTitle("Manual Entry");
        manualEntry.setContent("Manually created");
        kbRepository.save(manualEntry);

        // Act
        List<KnowledgeBaseEntity> pdfResults = kbRepository.findBySourceIsNotNull();
        List<KnowledgeBaseEntity> manualResults = kbRepository.findBySourceIsNull();

        // Assert
        assertEquals(1, pdfResults.size());
        assertEquals("PDF Chunk", pdfResults.get(0).getTitle());
        assertEquals(1, manualResults.size());
        assertEquals("Manual Entry", manualResults.get(0).getTitle());
    }

    @Test
    void deleteBySource_removesAllChunks() {
        // Arrange
        for (int i = 0; i < 3; i++) {
            KnowledgeBaseEntity entry = new KnowledgeBaseEntity();
            entry.setTitle("Chunk " + i);
            entry.setContent("Content " + i);
            entry.setSource("Book A");
            kbRepository.save(entry);
        }
        KnowledgeBaseEntity other = new KnowledgeBaseEntity();
        other.setTitle("Other Book Chunk");
        other.setContent("Other content");
        other.setSource("Book B");
        kbRepository.save(other);

        // Act
        kbRepository.deleteBySource("Book A");

        // Assert
        List<KnowledgeBaseEntity> remaining = kbRepository.findAll();
        assertEquals(1, remaining.size());
        assertEquals("Book B", remaining.get(0).getSource());
    }

    // --- Helpers ---

    private float[] createEmbedding(float x, float y, float z) {
        float[] embedding = new float[1536];
        embedding[0] = x;
        embedding[1] = y;
        embedding[2] = z;
        return embedding;
    }

    private String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    private void saveKb(String title, float[] embedding) {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setTitle(title);
        entity.setContent("Content for " + title);
        entity.setEmbedding(embedding);
        kbRepository.save(entity);
    }
}
