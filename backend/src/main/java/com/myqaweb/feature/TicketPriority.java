package com.myqaweb.feature;

/**
 * Priority levels for bug tickets (5 levels).
 */
public enum TicketPriority {
    HIGHEST, HIGH, MEDIUM, LOW, LOWEST;

    /**
     * Maps a test case priority (3 levels) to the ticket priority scale (5 levels):
     * HIGH to HIGH, MEDIUM to MEDIUM, LOW to LOW.
     */
    public static TicketPriority from(Priority priority) {
        return switch (priority) {
            case HIGH -> HIGH;
            case MEDIUM -> MEDIUM;
            case LOW -> LOW;
        };
    }
}
