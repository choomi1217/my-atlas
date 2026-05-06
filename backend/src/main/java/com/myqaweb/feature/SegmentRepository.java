package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Segment entities.
 */
@Repository
public interface SegmentRepository extends JpaRepository<SegmentEntity, Long> {
    List<SegmentEntity> findAllByProductId(Long productId);

    List<SegmentEntity> findAllByParentId(Long parentId);

    /**
     * Returns the maximum order_index within the (productId, parentId) sibling group.
     * Used to append a new segment to the end of its sibling group.
     * Returns -1 when the group is empty so callers can use (max + 1) → 0 for the first child.
     */
    @Query("SELECT COALESCE(MAX(s.orderIndex), -1) FROM SegmentEntity s "
         + "WHERE s.product.id = :productId "
         + "AND ((:parentId IS NULL AND s.parent IS NULL) OR s.parent.id = :parentId)")
    Integer findMaxOrderIndex(@Param("productId") Long productId,
                              @Param("parentId") Long parentId);

    /**
     * Counts root segments (parent IS NULL) within a product.
     * Used to prevent deletion of the last root segment.
     */
    long countByProductIdAndParentIsNull(Long productId);
}
