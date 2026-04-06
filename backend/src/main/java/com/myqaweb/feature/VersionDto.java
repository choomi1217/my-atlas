package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Version domain.
 */
public class VersionDto {
    public record CreateVersionRequest(
            @NotNull(message = "Product ID is required")
            Long productId,
            @NotBlank(message = "Version name is required")
            String name,
            String description,
            LocalDate releaseDate,
            @NotEmpty(message = "At least one phase is required")
            List<PhaseRequest> phases
    ) {}

    public record PhaseRequest(
            @NotBlank(message = "Phase name is required")
            String phaseName,
            @NotNull(message = "Test run ID is required")
            Long testRunId
    ) {}

    public record UpdateVersionRequest(
            String name,
            String description,
            LocalDate releaseDate
    ) {}

    public record VersionCopyRequest(
            @NotBlank(message = "New version name is required")
            String newName,
            LocalDate newReleaseDate
    ) {}

    public record VersionPhaseDto(
            Long id,
            String phaseName,
            Long testRunId,
            String testRunName,
            Integer testRunTestCaseCount,
            Integer orderIndex,
            ProgressStats phaseProgress
    ) {}

    public record ProgressStats(
            Integer total,
            Integer completed,
            Integer pass,
            Integer fail,
            Integer blocked,
            Integer skipped,
            Integer retest,
            Integer untested
    ) {}

    public record VersionSummary(
            Long id,
            Long productId,
            String name,
            String description,
            LocalDate releaseDate,
            Long copiedFrom,
            Integer phaseCount,
            ProgressStats totalProgress,
            Boolean isReleaseDatePassed,
            String warningMessage,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record VersionDetail(
            Long id,
            Long productId,
            String name,
            String description,
            LocalDate releaseDate,
            Long copiedFrom,
            List<VersionPhaseDto> phases,
            ProgressStats totalProgress,
            Boolean isReleaseDatePassed,
            String warningMessage,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}
}
