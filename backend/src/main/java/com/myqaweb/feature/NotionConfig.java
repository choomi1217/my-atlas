package com.myqaweb.feature;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Notion integration configuration (bug tickets are published to the PRD database).
 */
@Configuration
@ConfigurationProperties(prefix = "notion")
@Data
public class NotionConfig {
    private String apiKey;
    private String bugDatabaseId;
}
