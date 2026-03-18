package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

/**
 * DTOs for Product domain.
 */
public class ProductDto {
    public record ProductRequest(
            @NotNull(message = "Company ID is required")
            Long companyId,
            @NotBlank(message = "Product name is required")
            String name,
            @NotNull(message = "Platform is required")
            Platform platform,
            String description
    ) {}

    public record ProductResponse(
            Long id,
            Long companyId,
            String name,
            Platform platform,
            String description,
            LocalDateTime createdAt
    ) {}
}
