package com.myqaweb.senior;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

public class FaqDto {

    public record FaqRequest(
            @NotBlank(message = "Title is required")
            String title,

            @NotBlank(message = "Content is required")
            String content,

            String tags
    ) {}

    public record FaqResponse(
            Long id,
            String title,
            String content,
            String tags,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}
}
