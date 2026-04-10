package com.myqaweb.senior;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

public class ChatSessionDto {

    public record SessionResponse(
            Long id,
            String title,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record SessionDetailResponse(
            Long id,
            String title,
            List<MessageResponse> messages,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record MessageResponse(
            Long id,
            String role,
            String content,
            LocalDateTime createdAt
    ) {}

    public record UpdateTitleRequest(
            @NotBlank(message = "Title is required")
            String title
    ) {}
}
