package com.myqaweb.senior;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FaqRepository extends JpaRepository<FaqEntity, Long> {

    /**
     * Finds the most similar FAQ entries by cosine distance using pgvector.
     *
     * @param queryVector the query embedding vector as a string representation
     * @param topK        the maximum number of results to return
     * @return list of FAQ entities ordered by similarity (most similar first)
     */
    @Query(value = "SELECT * FROM faq WHERE embedding IS NOT NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<FaqEntity> findSimilar(@Param("queryVector") String queryVector,
                                @Param("topK") int topK);

    @Modifying
    @Query(value = "UPDATE faq SET embedding = cast(:embedding as vector) WHERE id = :id",
            nativeQuery = true)
    void updateEmbedding(@Param("id") Long id, @Param("embedding") String embedding);
}
