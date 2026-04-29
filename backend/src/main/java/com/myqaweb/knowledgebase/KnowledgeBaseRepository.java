package com.myqaweb.knowledgebase;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseEntity, Long> {

    // --- Active-only queries (exclude soft-deleted) ---

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.deletedAt IS NULL ORDER BY k.createdAt DESC")
    List<KnowledgeBaseEntity> findAllActive();

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.id = :id AND k.deletedAt IS NULL")
    Optional<KnowledgeBaseEntity> findActiveById(@Param("id") Long id);

    // --- Search + Sort ---

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.deletedAt IS NULL " +
            "AND (:search IS NULL OR :search = '' " +
            "     OR LOWER(k.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(k.content) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY k.createdAt DESC")
    List<KnowledgeBaseEntity> findActiveBySearchNewest(@Param("search") String search);

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.deletedAt IS NULL " +
            "AND (:search IS NULL OR :search = '' " +
            "     OR LOWER(k.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(k.content) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY k.createdAt ASC")
    List<KnowledgeBaseEntity> findActiveBySearchOldest(@Param("search") String search);

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.deletedAt IS NULL " +
            "AND (:search IS NULL OR :search = '' " +
            "     OR LOWER(k.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(k.content) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY k.title ASC")
    List<KnowledgeBaseEntity> findActiveBySearchTitle(@Param("search") String search);

    // --- Vector search (exclude soft-deleted) ---

    @Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND deleted_at IS NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findSimilar(@Param("queryVector") String queryVector,
                                          @Param("topK") int topK);

    @Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND source IS NULL AND deleted_at IS NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findSimilarManual(@Param("queryVector") String queryVector,
                                                 @Param("topK") int topK);

    @Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND source IS NOT NULL AND deleted_at IS NULL "
            + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findSimilarPdf(@Param("queryVector") String queryVector,
                                              @Param("topK") int topK);

    // --- Source filters (exclude soft-deleted) ---

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.source IS NULL AND k.deletedAt IS NULL")
    List<KnowledgeBaseEntity> findBySourceIsNullAndActive();

    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.source IS NOT NULL AND k.deletedAt IS NULL")
    List<KnowledgeBaseEntity> findBySourceIsNotNullAndActive();

    void deleteBySource(String source);

    // --- Soft Delete ---

    @Transactional
    @Modifying
    @Query("UPDATE KnowledgeBaseEntity k SET k.deletedAt = :now WHERE k.id = :id")
    void softDelete(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying
    @Query("UPDATE KnowledgeBaseEntity k SET k.deletedAt = :now WHERE k.source = :source AND k.deletedAt IS NULL")
    void softDeleteBySource(@Param("source") String source, @Param("now") LocalDateTime now);

    // --- Embedding ---

    @Transactional
    @Modifying
    @Query(value = "UPDATE knowledge_base SET embedding = cast(:embedding as vector) WHERE id = :id",
            nativeQuery = true)
    void updateEmbedding(@Param("id") Long id, @Param("embedding") String embedding);

    // --- 큐레이션 FAQ 관련 쿼리 (exclude soft-deleted) ---

    @Query(value = "SELECT * FROM knowledge_base WHERE pinned_at IS NOT NULL AND deleted_at IS NULL "
            + "ORDER BY pinned_at ASC LIMIT 10",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findPinned();

    @Query(value = "SELECT * FROM knowledge_base WHERE deleted_at IS NULL ORDER BY hit_count DESC LIMIT :limit",
            nativeQuery = true)
    List<KnowledgeBaseEntity> findTopByHitCount(@Param("limit") int limit);

    @Transactional
    @Modifying
    @Query(value = "UPDATE knowledge_base SET hit_count = hit_count + 1 WHERE id = :id",
            nativeQuery = true)
    void incrementHitCount(@Param("id") Long id);

    @Transactional
    @Modifying
    @Query("UPDATE KnowledgeBaseEntity k SET k.pinnedAt = :pinnedAt WHERE k.id = :id")
    void updatePinnedAt(@Param("id") Long id, @Param("pinnedAt") java.time.LocalDateTime pinnedAt);

    @Query("SELECT COUNT(k) FROM KnowledgeBaseEntity k WHERE k.pinnedAt IS NOT NULL AND k.deletedAt IS NULL")
    long countByPinnedAtIsNotNull();
}
