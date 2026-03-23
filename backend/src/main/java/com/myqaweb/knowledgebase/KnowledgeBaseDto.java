package com.myqaweb.knowledgebase;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

public class KnowledgeBaseDto {

    public record KbRequest(
            @NotBlank(message = "Title is required")
            String title,

            @NotBlank(message = "Content is required")
            String content,

            String category,

            String tags
    ) {}

    public record KbResponse(
            Long id,
            String title,
            String content,
            String category,
            String tags,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}
}
