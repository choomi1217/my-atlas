package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;

import java.time.LocalDateTime;

/**
 * DTOs for Feature domain.
 */
public class FeatureDto {
    public record FeatureRequest(
            @NotNull(message = "Product ID is required")
            Long productId,
            @NotBlank(message = "Path is required")
            String path,
            @NotBlank(message = "Feature name is required")
            String name,
            String description,
            String promptText
    ) {}

    public record FeatureResponse(
            Long id,
            Long productId,
            String path,
            String name,
            String description,
            String promptText,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record FeatureSearchQuery(
            @NotBlank(message = "Query is required")
            String query,
            @Min(value = 1, message = "topK must be at least 1")
            int topK
    ) {}
}
