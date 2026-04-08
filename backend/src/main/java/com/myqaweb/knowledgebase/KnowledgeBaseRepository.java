package com.myqaweb.knowledgebase;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseEntity, Long> {

    /**
     * Finds the most similar Knowledge Base entries by cosine distance using pgvector.
     *
     * @param queryVector the query embedding vector as a string representation
     * @param topK        the maximum number of results to return
     * @return list of KB entities ordered by similarity (most similar first)
     */
    @Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findSimilar(@Param("queryVector") String queryVector,
                                          @Param("topK") int topK);

    /**
     * Finds similar manual KB entries (source IS NULL) by cosine distance.
     */
    @Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND source IS NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findSimilarManual(@Param("queryVector") String queryVector,
                                                 @Param("topK") int topK);

    /**
     * Finds similar PDF KB entries (source IS NOT NULL) by cosine distance.
     */
    @Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND source IS NOT NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findSimilarPdf(@Param("queryVector") String queryVector,
                                              @Param("topK") int topK);

    List<KnowledgeBaseEntity> findBySourceIsNull();

    List<KnowledgeBaseEntity> findBySourceIsNotNull();

    void deleteBySource(String source);

    @Modifying
    @Query(value = "UPDATE knowledge_base SET embedding = cast(:embedding as vector) WHERE id = :id",
            nativeQuery = true)
    void updateEmbedding(@Param("id") Long id, @Param("embedding") String embedding);
}
