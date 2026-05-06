package com.myqaweb.feature;

import java.util.List;

/**
 * Service interface for Segment operations.
 */
public interface SegmentService {

    /**
     * Fetches all segments belonging to a product.
     *
     * @param productId the product ID
     * @return list of segment responses
     */
    List<SegmentDto.SegmentResponse> findByProductId(Long productId);

    /**
     * Creates a new segment.
     *
     * @param request the segment creation request
     * @return the created segment response
     */
    SegmentDto.SegmentResponse create(SegmentDto.SegmentRequest request);

    /**
     * Updates a segment's name.
     *
     * @param id the segment ID
     * @param name the new name
     * @return the updated segment response
     */
    SegmentDto.SegmentResponse update(Long id, String name);

    /**
     * Deletes a segment and its children (cascading).
     *
     * @param id the segment ID
     */
    void delete(Long id);

    /**
     * Changes a segment's parent (reparent) with circular reference validation.
     * Ensures that a segment cannot become a descendant of itself.
     *
     * @param id the segment ID to reparent
     * @param newParentId the new parent segment ID (null to make root)
     * @return the updated segment response
     * @throws IllegalArgumentException if the segment is not found, the new parent is not found,
     *                                   they belong to different products, or circular reference is detected
     */
    SegmentDto.SegmentResponse reparent(Long id, Long newParentId);

    /**
     * Checks if a potential parent is a descendant of the given segment.
     * Used for circular reference detection.
     *
     * @param segmentId the segment to check against
     * @param potentialParentId the potential parent to check
     * @return true if potentialParentId is a descendant of segmentId, false otherwise
     */
    boolean isDescendant(Long segmentId, Long potentialParentId);

    /**
     * Validates if reparenting is allowed based on business rules.
     *
     * @param segmentId the segment ID to reparent
     * @param newParentId the new parent segment ID (null is allowed)
     * @throws IllegalArgumentException if reparenting is not allowed
     */
    void validateReparent(Long segmentId, Long newParentId);

    /**
     * Reorders sibling segments within the same (productId, parentId) group.
     * The provided segmentIds list defines the new order; orderIndex is reassigned 0..N-1.
     *
     * @param request the reorder request
     * @throws IllegalArgumentException when any segment is missing, belongs to a different product,
     *                                   or is not in the requested parent group
     */
    void reorder(SegmentDto.ReorderRequest request);
}
