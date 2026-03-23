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
        String expectedResult,
        Priority priority,
        TestType testType,
        TestStatus status
    ) {}

    public record TestCaseResponse(
        Long id,
        Long productId,
        Long[] path,
        String title,
        String description,
        String promptText,
        String preconditions,
        List<TestStep> steps,
        String expectedResult,
        Priority priority,
        TestType testType,
        TestStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
    ) {}

    public record GenerateDraftRequest(
        @NotNull Long productId,
        Long[] path
    ) {}
}
