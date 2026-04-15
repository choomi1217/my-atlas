package com.myqaweb.feature;

import java.util.List;

/**
 * Ticket service for Jira issue management.
 */
public interface TicketService {

    /**
     * Create a Jira ticket for a test result.
     */
    TicketDto.TicketResponse createTicket(Long resultId, TicketDto.CreateTicketRequest request);

    /**
     * Get all tickets for a test result.
     */
    List<TicketDto.TicketResponse> getTicketsByResultId(Long resultId);

    /**
     * Delete a ticket.
     */
    void deleteTicket(Long ticketId);

    /**
     * Refresh ticket status from Jira.
     */
    TicketDto.TicketResponse refreshTicketStatus(Long ticketId);

    /**
     * Get ticket count for a test result.
     */
    int getTicketCount(Long resultId);
}
