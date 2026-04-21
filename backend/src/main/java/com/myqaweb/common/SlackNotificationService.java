package com.myqaweb.common;

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

    public SlackNotificationService(
            @Value("${slack.webhook.url:}") String webhookUrl) {
        this.webhookUrl = webhookUrl;
        this.restTemplate = new RestTemplate();
    }

    @Async
    public void notifyAiUsage(String username, String endpoint, int estimatedTokens) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack webhook URL not configured, skipping AI usage notification");
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
