package com.myqaweb.convention;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

public class ConventionDto {

    public record ConventionRequest(
            @NotBlank(message = "Term is required")
            String term,

            @NotBlank(message = "Definition is required")
            String definition,

            String category
    ) {}

    public record ConventionResponse(
            Long id,
            String term,
            String definition,
            String category,
            LocalDateTime createdAt
    ) {}
}
