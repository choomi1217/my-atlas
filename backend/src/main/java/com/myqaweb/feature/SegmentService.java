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
     * Changes a segment's parent (reparent).
     *
     * @param id the segment ID to reparent
     * @param newParentId the new parent segment ID (null to make root)
     * @return the updated segment response
     */
    SegmentDto.SegmentResponse reparent(Long id, Long newParentId);
}
