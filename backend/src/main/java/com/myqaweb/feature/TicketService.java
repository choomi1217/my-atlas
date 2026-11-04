package com.myqaweb.feature;

import java.util.List;

/**
 * Ticket service for bug ticket management (new tickets go to Notion; legacy Jira tickets are still refreshed).
 */
public interface TicketService {

    /**
     * Create a bug ticket (Notion PRD page) for a test result.
     */
    TicketDto.TicketResponse createTicket(Long resultId, TicketDto.CreateTicketRequest request);

    /**
     * Get the tracker new tickets are published to and whether it is configured.
     */
    TicketDto.TrackerConfig getTrackerConfig();

    /**
     * Get all tickets for a test result.
     */
    List<TicketDto.TicketResponse> getTicketsByResultId(Long resultId);

    /**
     * Delete a ticket.
     */
    void deleteTicket(Long ticketId);

    /**
     * Refresh ticket status from its tracker (Notion or Jira).
     */
    TicketDto.TicketResponse refreshTicketStatus(Long ticketId);

    /**
     * Get ticket count for a test result.
     */
    int getTicketCount(Long resultId);

    /**
     * Refresh all ticket statuses for a given phase from their trackers.
     *
     * @return number of tickets refreshed
     */
    int refreshAllByPhaseId(Long phaseId);
}
