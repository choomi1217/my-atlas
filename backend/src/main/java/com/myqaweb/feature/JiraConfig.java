package com.myqaweb.feature;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Jira integration configuration.
 */
@Configuration
@ConfigurationProperties(prefix = "jira")
@Data
public class JiraConfig {
    private String baseUrl;
    private String email;
    private String apiKey;
    private String defaultProjectKey;
    private String issueTypeId;
}
