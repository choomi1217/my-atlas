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
            String description
    ) {}

    public record TicketResponse(
            Long id,
            Long testResultId,
            String jiraKey,
            String jiraUrl,
            String summary,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}
}
