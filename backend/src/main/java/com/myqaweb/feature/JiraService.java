package com.myqaweb.feature;

/**
 * Jira REST API integration service (status lookup for existing Jira tickets).
 */
public interface JiraService {

    /**
     * Check if Jira is properly configured.
     */
    boolean isConfigured();

    /**
     * Get the current status of a Jira issue.
     *
     * @param jiraKey issue key (e.g., "AT-1")
     * @return status name (e.g., "해야 할 일", "진행 중", "완료")
     */
    String getIssueStatus(String jiraKey);
}
