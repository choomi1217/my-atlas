package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

public class TestResultCommentDto {
    public record CreateCommentRequest(
            String author,
            @NotBlank(message = "Content is required")
            String content,
            Long parentId,
            String imageUrl
    ) {}

    public record CommentResponse(
            Long id,
            Long testResultId,
            Long parentId,
            String author,
            String content,
            String imageUrl,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<CommentResponse> children
    ) {}
}
