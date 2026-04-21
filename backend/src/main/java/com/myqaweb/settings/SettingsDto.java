package com.myqaweb.settings;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public class SettingsDto {

    public record SystemSettingsResponse(
            boolean aiEnabled,
            long sessionTimeoutSeconds,
            boolean loginRequired,
            int aiRateLimitPerIp,
            int aiRateLimitWindowSeconds
    ) {}

    public record UpdateSettingsRequest(
            Boolean aiEnabled,
            Long sessionTimeoutSeconds,
            Boolean loginRequired,
            Integer aiRateLimitPerIp,
            Integer aiRateLimitWindowSeconds
    ) {}

    public record PublicSettingsResponse(
            boolean loginRequired
    ) {}

    public record UserWithCompaniesResponse(
            Long id,
            String username,
            String role,
            List<CompanyInfo> companies,
            LocalDateTime createdAt
    ) {}

    public record CompanyInfo(
            Long id,
            String name
    ) {}

    public record RegisterUserRequest(
            @NotBlank(message = "Username is required")
            @Size(min = 2, max = 50, message = "Username must be 2-50 characters")
            String username,

            @NotBlank(message = "Password is required")
            @Size(min = 4, max = 100, message = "Password must be 4-100 characters")
            String password,

            @NotNull(message = "Company IDs are required")
            List<Long> companyIds
    ) {}

    public record UpdateCompaniesRequest(
            @NotNull(message = "Company IDs are required")
            List<Long> companyIds
    ) {}
}
