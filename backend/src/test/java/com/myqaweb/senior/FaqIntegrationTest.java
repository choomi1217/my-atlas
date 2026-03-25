package com.myqaweb.senior;

import com.myqaweb.common.BaseIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for FAQ vector search using real pgvector database.
 */
@Transactional
class FaqIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private FaqRepository faqRepository;

    @BeforeEach
    void setUp() {
        faqRepository.deleteAll();
    }

    @Test
    void findSimilar_returnsTopKFaqs() {
        // Arrange
        float[] target = createEmbedding(1.0f, 0.0f, 0.0f);
        saveFaq("Most Similar", createEmbedding(0.9f, 0.1f, 0.0f));
        saveFaq("Somewhat Similar", createEmbedding(0.5f, 0.5f, 0.0f));
        saveFaq("Not Similar", createEmbedding(0.0f, 1.0f, 0.0f));

        // Act
        List<FaqEntity> results = faqRepository.findSimilar(toVectorString(target), 2);

        // Assert
        assertEquals(2, results.size());
        assertEquals("Most Similar", results.get(0).getTitle());
        assertEquals("Somewhat Similar", results.get(1).getTitle());
    }

    @Test
    void findSimilar_excludesNullEmbeddings() {
        // Arrange
        saveFaq("With Embedding", createEmbedding(1.0f, 0.0f, 0.0f));
        FaqEntity noEmbed = new FaqEntity();
        noEmbed.setTitle("No Embedding");
        noEmbed.setContent("Content without embedding");
        faqRepository.save(noEmbed);

        // Act
        List<FaqEntity> results = faqRepository.findSimilar(
                toVectorString(createEmbedding(1.0f, 0.0f, 0.0f)), 10);

        // Assert
        assertEquals(1, results.size());
        assertEquals("With Embedding", results.get(0).getTitle());
    }

    @Test
    void saveFaqWithEmbedding_persistsVector() {
        // Arrange
        float[] embedding = createEmbedding(0.3f, 0.7f, 0.1f);
        saveFaq("Test FAQ", embedding);

        // Act
        FaqEntity saved = faqRepository.findAll().get(0);

        // Assert
        assertNotNull(saved.getEmbedding());
        assertEquals(1536, saved.getEmbedding().length);
        assertEquals(0.3f, saved.getEmbedding()[0], 0.001f);
        assertEquals(0.7f, saved.getEmbedding()[1], 0.001f);
        assertEquals(0.1f, saved.getEmbedding()[2], 0.001f);
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

    private void saveFaq(String title, float[] embedding) {
        FaqEntity entity = new FaqEntity();
        entity.setTitle(title);
        entity.setContent("Content for " + title);
        entity.setTags("test");
        entity.setEmbedding(embedding);
        faqRepository.save(entity);
    }
}
