package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

/**
 * DTOs for Company domain.
 */
public class CompanyDto {
    public record CompanyRequest(
            @NotBlank(message = "Company name is required")
            String name
    ) {}

    public record CompanyResponse(
            Long id,
            String name,
            Boolean isActive,
            LocalDateTime createdAt
    ) {}
}
