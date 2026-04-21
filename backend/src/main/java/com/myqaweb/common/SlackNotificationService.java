package com.myqaweb.common;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Service
@Slf4j
public class SlackNotificationService {

    private final String webhookUrl;
    private final RestTemplate restTemplate;
    private final boolean enabled;

    public SlackNotificationService(
            @Value("${slack.webhook.url:}") String webhookUrl) {
        this.webhookUrl = webhookUrl;
        this.restTemplate = new RestTemplate();
        this.enabled = webhookUrl != null && !webhookUrl.isBlank();
    }

    @PostConstruct
    void logConfigStatus() {
        if (enabled) {
            log.info("Slack AI usage notifications: enabled");
        } else {
            log.info("Slack AI usage notifications: disabled (slack.webhook.url not set)");
        }
    }

    @Async
    public void notifyAiUsage(String username, String endpoint, int estimatedTokens) {
        if (!enabled) {
            return;
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String message = String.format(
                "AI Token Usage — my-atlas\nUser: %s\nEndpoint: %s\nEstimated Tokens: ~%,d\nTime: %s",
                username, endpoint, estimatedTokens, timestamp);

        try {
            restTemplate.postForEntity(webhookUrl, Map.of("text", message), String.class);
            log.debug("Slack AI usage notification sent for user={}", username);
        } catch (Exception e) {
            log.warn("Failed to send Slack notification: {}", e.getMessage());
        }
    }
}
