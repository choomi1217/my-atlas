package com.myqaweb.teststudio;

import com.myqaweb.feature.Priority;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for 스타일 세트 내 예시 TC.
 */
public class TestStudioStyleExampleDto {

    /** 예시 TC 응답. 기본 견본(Sample)은 id/profileId 가 null 로 채워진다. */
    public record ExampleResponse(
            Long id,
            Long profileId,
            String title,
            String preconditions,
            List<TestStep> steps,
            List<String> expectedResults,
            Priority priority,
            TestType testType,
            Integer sortOrder,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    /** 예시 TC 생성/수정 요청 (기존 TC 작성 폼과 동일 바디). */
    public record ExampleRequest(
            @NotBlank(message = "title is required")
            String title,
            String preconditions,
            List<TestStep> steps,
            List<String> expectedResults,
            Priority priority,
            TestType testType,
            Integer sortOrder
    ) {}
}
