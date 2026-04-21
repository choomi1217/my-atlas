package com.myqaweb.common;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

/**
 * Common DTO for category operations, shared by KB and Convention domains.
 */
public class CategoryDto {

    public record CategoryRequest(
            @NotBlank(message = "Category name is required")
            String name
    ) {}

    public record CategoryResponse(
            Long id,
            String name,
            LocalDateTime createdAt
    ) {}
}
