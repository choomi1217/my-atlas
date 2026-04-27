package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

public class TestCaseDto {
    public record TestCaseRequest(
        @NotNull Long productId,
        Long[] path,
        @NotBlank String title,
        String description,
        String promptText,
        String preconditions,
        List<TestStep> steps,
        List<String> expectedResults,
        Priority priority,
        TestType testType,
        TestStatus status
    ) {}

    public record TestCaseResponse(
        Long id,
        Long productId,
        Long[] path,
        String[] suggestedSegmentPath,
        String title,
        String description,
        String promptText,
        String preconditions,
        List<TestStep> steps,
        List<String> expectedResults,
        Priority priority,
        TestType testType,
        TestStatus status,
        List<TestCaseImageResponse> images,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long testStudioJobId
    ) {}

    public record TestCaseImageResponse(
        Long id,
        String filename,
        String originalName,
        Integer orderIndex,
        String url
    ) {}

    public record GenerateDraftRequest(
        @NotNull Long productId,
        Long[] path
    ) {}

    /** Body for PATCH /api/test-cases/{id}/path — user manually overrides the segment path. */
    public record UpdatePathRequest(Long[] path) {}

    /** Body for POST /api/test-cases/bulk-apply-suggested-path. */
    public record BulkApplySuggestedPathRequest(@NotNull List<Long> testCaseIds) {}

    /**
     * Response for apply-suggested-path endpoints.
     *
     * @param testCaseId the TC id
     * @param resolvedPath the resolved segment-id array (may be shorter than suggested names on partial match)
     * @param resolvedLength how many names matched
     * @param fullMatch true when the resolved path fully covers the suggested names
     * @param suggestedLength total number of names in the suggestion (0 if none was stored)
     * @param error null on success, non-null with a reason string on failure (e.g. "NOT_FOUND", "NO_SUGGESTION")
     */
    public record ApplySuggestedPathResponse(
        Long testCaseId,
        Long[] resolvedPath,
        int resolvedLength,
        boolean fullMatch,
        int suggestedLength,
        int createdSegmentCount,
        String error
    ) {}
}
