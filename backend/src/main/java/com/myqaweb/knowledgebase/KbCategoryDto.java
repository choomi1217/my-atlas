package com.myqaweb.knowledgebase;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

public class KbCategoryDto {

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
