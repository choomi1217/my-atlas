package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Segment entities.
 */
@Repository
public interface SegmentRepository extends JpaRepository<SegmentEntity, Long> {
    List<SegmentEntity> findAllByProductId(Long productId);

    List<SegmentEntity> findAllByParentId(Long parentId);
}
