package com.myqaweb.knowledgebase;

import java.time.LocalDateTime;

public class PdfUploadJobDto {

    public record JobResponse(
            Long id,
            String bookTitle,
            String originalFilename,
            String status,
            Integer totalChunks,
            String errorMessage,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {}
}
