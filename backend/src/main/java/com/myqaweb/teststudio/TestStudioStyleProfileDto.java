package com.myqaweb.teststudio;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * DTOs for Test Studio 스타일 세트(프로필).
 */
public class TestStudioStyleProfileDto {

    /** 세트 응답. exampleCount 로 세트 내 예시 수를 함께 노출. */
    public record ProfileResponse(
            Long id,
            Long companyId,
            String name,
            long exampleCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    /** 세트 생성 요청. */
    public record CreateRequest(
            @NotNull(message = "companyId is required")
            Long companyId,
            @NotBlank(message = "name is required")
            @Size(max = 100, message = "name must be at most 100 characters")
            String name
    ) {}

    /** 세트 이름 변경 요청. */
    public record RenameRequest(
            @NotBlank(message = "name is required")
            @Size(max = 100, message = "name must be at most 100 characters")
            String name
    ) {}
}
