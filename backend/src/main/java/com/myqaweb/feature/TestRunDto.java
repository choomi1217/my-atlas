package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for TestRun domain.
 */
public class TestRunDto {
    /**
     * Request body for creating a test run (productId comes from path).
     */
    public record CreateTestRunRequestBody(
            @NotBlank(message = "Test run name is required")
            String name,
            String description,
            @NotEmpty(message = "At least one test case is required")
            List<Long> testCaseIds
    ) {}

    /**
     * Complete request with productId (used internally after combining path + body).
     */
    public record CreateTestRunRequest(
            @NotNull(message = "Product ID is required")
            Long productId,
            @NotBlank(message = "Test run name is required")
            String name,
            String description,
            @NotEmpty(message = "At least one test case is required")
            List<Long> testCaseIds
    ) {}

    public record UpdateTestRunRequest(
            String name,
            String description,
            List<Long> testCaseIds
    ) {}

    public record TestCaseSummary(
            Long id,
            String title
    ) {}

    public record TestRunSummary(
            Long id,
            Long productId,
            String name,
            String description,
            Integer testCaseCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record TestRunDetail(
            Long id,
            Long productId,
            String name,
            String description,
            List<TestCaseSummary> testCases,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}
}
