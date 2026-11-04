package com.myqaweb.feature;

/**
 * Issue tracker a ticket was published to. New tickets go to NOTION; JIRA is kept for legacy tickets.
 */
public enum TicketTracker {
    JIRA, NOTION
}
