package com.myqaweb.feature;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

/**
 * Ticket DTOs for API request/response.
 */
public class TicketDto {

    public record CreateTicketRequest(
            @NotBlank(message = "Ticket summary is required")
            String summary,
            String description,
            TicketPriority priority,
            String pageUrl
    ) {}

    public record TicketResponse(
            Long id,
            Long testResultId,
            String issueKey,
            String issueUrl,
            TicketTracker tracker,
            String summary,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record TrackerConfig(
            TicketTracker tracker,
            boolean configured
    ) {}
}
