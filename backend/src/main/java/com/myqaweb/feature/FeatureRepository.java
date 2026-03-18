package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Feature entity with pgvector support.
 */
@Repository
public interface FeatureRepository extends JpaRepository<FeatureEntity, Long> {
    /**
     * Find all features by product ID.
     *
     * @param productId the product ID
     * @return list of features
     */
    List<FeatureEntity> findAllByProductId(Long productId);

    /**
     * Find top K similar features by embedding using pgvector cosine similarity.
     * TODO: Implement pgvector similarity search with proper embedding format
     *
     * @param topK the number of results to return
     * @return list of top k similar features
     */
    // @Query(value = "SELECT * FROM feature f WHERE f.embedding IS NOT NULL ORDER BY f.embedding <=> CAST(:embedding AS vector(1536)) LIMIT :k", nativeQuery = true)
    // List<FeatureEntity> findTopKByEmbedding(@Param("embedding") String embedding, @Param("k") int k);
}
