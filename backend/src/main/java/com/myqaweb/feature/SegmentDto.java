package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

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
            Long parentId
    ) {}
}
