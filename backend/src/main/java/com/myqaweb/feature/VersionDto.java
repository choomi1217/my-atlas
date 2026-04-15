package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

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
            LocalDate releaseDate
    ) {}

    public record PhaseRequest(
            @NotBlank(message = "Phase name is required")
            String phaseName,
            List<Long> testRunIds,
            List<Long> testCaseIds
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

    /** Summary of a TestRun referenced by a phase */
    public record TestRunRef(
            Long testRunId,
            String testRunName,
            Integer testCaseCount
    ) {}

    public record VersionPhaseDto(
            Long id,
            String phaseName,
            List<TestRunRef> testRuns,
            Integer totalTestCaseCount,
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

    /** Request to add/remove individual TCs from a phase */
    public record PhaseTestCaseIdsRequest(
            @NotEmpty(message = "At least one test case ID is required")
            List<Long> testCaseIds
    ) {}

    /** Info about a failed TC in a version (for "add failed TCs to phase") */
    public record FailedTestCaseInfo(
            Long testCaseId,
            String testCaseTitle,
            List<Long> testCasePath,
            String failedInPhaseName,
            Integer ticketCount
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
