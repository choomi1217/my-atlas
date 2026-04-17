package com.myqaweb.teststudio;

import java.time.LocalDateTime;

/**
 * DTOs for Test Studio Job API responses.
 */
public class TestStudioJobDto {

    public record JobResponse(
            Long id,
            Long productId,
            SourceType sourceType,
            String sourceTitle,
            TestStudioJobStatus status,
            String errorMessage,
            Integer generatedCount,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {}
}
