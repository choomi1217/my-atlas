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
     * Find all descendants of a segment (direct children and their children recursively).
     * Uses a recursive CTE to traverse the hierarchy.
     *
     * @param segmentId the parent segment ID
     * @return list of all descendant segments
     */
    @Query("""
        WITH RECURSIVE descendants AS (
            SELECT id, parent_id FROM segment WHERE parent_id = :segmentId
            UNION ALL
            SELECT s.id, s.parent_id FROM segment s
            INNER JOIN descendants d ON s.parent_id = d.id
        )
        SELECT s FROM SegmentEntity s WHERE s.id IN (SELECT id FROM descendants)
    """)
    List<SegmentEntity> findAllDescendants(@Param("segmentId") Long segmentId);
}
