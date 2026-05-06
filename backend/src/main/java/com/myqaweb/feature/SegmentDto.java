package com.myqaweb.feature;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * DTOs for Segment API request/response.
 */
public class SegmentDto {

    public record SegmentRequest(
            @NotNull Long productId,
            @NotBlank String name,
            Long parentId
    ) {}

    public record SegmentResponse(
            Long id,
            String name,
            Long productId,
            Long parentId,
            Integer orderIndex
    ) {}

    public record ReparentRequest(
            Long parentId
    ) {}

    /**
     * Body for PATCH /api/segments/reorder.
     * Reorders sibling segments within the same (productId, parentId) group.
     * segmentIds must list the new order; the service assigns orderIndex 0..N-1.
     */
    public record ReorderRequest(
            @NotNull Long productId,
            Long parentId,
            @NotEmpty List<Long> segmentIds
    ) {}
}
