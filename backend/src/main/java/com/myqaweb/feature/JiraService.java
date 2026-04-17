package com.myqaweb.feature;

/**
 * Jira REST API integration service.
 */
public interface JiraService {

    /**
     * Check if Jira is properly configured.
     */
    boolean isConfigured();

    /**
     * Create a Bug issue in Jira.
     *
     * @param projectKey Jira project key (e.g., "AT")
     * @param summary    issue summary
     * @param description issue description
     * @param priority   Jira priority name (e.g., "Highest", "High", "Medium", "Low", "Lowest")
     * @return created issue info
     */
    JiraIssueInfo createIssue(String projectKey, String summary, String description, String priority);

    /**
     * Get the current status of a Jira issue.
     *
     * @param jiraKey issue key (e.g., "AT-1")
     * @return status name (e.g., "해야 할 일", "진행 중", "완료")
     */
    String getIssueStatus(String jiraKey);

    record JiraIssueInfo(String key, String url) {}
}
