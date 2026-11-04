package com.myqaweb.feature;

import java.util.List;

/**
 * Notion API integration service (bug tickets in the PRD database).
 */
public interface NotionService {

    /** Status a newly created bug page starts with. */
    String STATUS_WAITING = "Waiting...";

    /**
     * Check if Notion is properly configured (API key and bug database id).
     */
    boolean isConfigured();

    /**
     * Create a bug page (Scope=Bug) in the PRD database.
     *
     * @param report bug report content
     * @return created page id and url
     */
    NotionPage createBugPage(BugReport report);

    /**
     * Get the current Status of a Notion page.
     *
     * @param pageId Notion page id
     * @return Status select name (e.g., "Waiting...", "Done", "Close")
     */
    String getStatus(String pageId);

    record NotionPage(String id, String url) {}

    record BugReport(
            String title,
            TicketPriority priority,
            List<String> preconditions,
            String testDataLink,
            List<String> testData,
            List<String> steps,
            List<String> expected,
            List<String> actual,
            String memo
    ) {}
}
