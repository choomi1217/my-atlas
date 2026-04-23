package com.myqaweb.config.slack;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Forwards ERROR log events to a Slack Incoming Webhook.
 *
 * Distinct from {@code com.myqaweb.common.SlackNotificationService}, which
 * publishes explicit AI-usage messages. This one is a log pipeline sink
 * wired by {@link SlackAppenderRegistrar} and should never be invoked by
 * feature code directly.
 *
 * Safety:
 * - Rate limit (MAX_PER_MINUTE) to prevent burst spam.
 * - Deduplication (DEDUP_WINDOW) to suppress repeated identical errors.
 * - Async daemon executor so calls never block the logging thread.
 * - No-op when slack.webhook.url is not set (local/dev).
 * - Failures inside send are logged at WARN only — using log.error here
 *   would re-trigger the Slack appender and loop.
 */
@Component
public class SlackNotifierService {

    private static final Logger log = LoggerFactory.getLogger(SlackNotifierService.class);

    static final int MAX_PER_MINUTE = 5;
    static final Duration DEDUP_WINDOW = Duration.ofMinutes(5);
    static final int STACK_TRACE_MAX = 1000;

    private final String webhookUrl;
    private final boolean enabled;

    private final AtomicInteger minuteCounter = new AtomicInteger(0);
    private final AtomicReference<Instant> minuteResetAt;
    private final Map<String, Instant> recentErrors = new ConcurrentHashMap<>();

    private final HttpClient httpClient;
    private final ExecutorService executor;
    private final ObjectMapper objectMapper;

    public SlackNotifierService(@Value("${slack.webhook.url:}") String webhookUrl,
                                ObjectMapper objectMapper) {
        this.webhookUrl = webhookUrl == null ? "" : webhookUrl.trim();
        this.enabled = !this.webhookUrl.isEmpty();
        this.minuteResetAt = new AtomicReference<>(Instant.now().plus(Duration.ofMinutes(1)));
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "slack-notifier");
            t.setDaemon(true);
            return t;
        });
        this.objectMapper = objectMapper;
    }

    /**
     * Entry point called by SlackLogbackAppender for each ERROR event.
     * Applies rate limit + dedup, then enqueues an async webhook POST.
     */
    public void notify(String loggerName, String message, String stackTrace) {
        if (!enabled) {
            return;
        }
        if (!acquireSlot()) {
            return;
        }
        if (isDuplicate(loggerName, message)) {
            return;
        }
        executor.submit(() -> sendSafely(loggerName, message, stackTrace));
    }

    public boolean isEnabled() {
        return enabled;
    }

    boolean acquireSlot() {
        Instant now = Instant.now();
        Instant reset = minuteResetAt.get();
        if (now.isAfter(reset)
                && minuteResetAt.compareAndSet(reset, now.plus(Duration.ofMinutes(1)))) {
            minuteCounter.set(0);
        }
        return minuteCounter.incrementAndGet() <= MAX_PER_MINUTE;
    }

    boolean isDuplicate(String loggerName, String message) {
        String key = loggerName + "|" + (message == null ? "" : message);
        Instant now = Instant.now();
        Instant last = recentErrors.put(key, now);
        if (last != null && Duration.between(last, now).compareTo(DEDUP_WINDOW) < 0) {
            recentErrors.put(key, last);
            return true;
        }
        evictStaleDedupEntries(now);
        return false;
    }

    private void evictStaleDedupEntries(Instant now) {
        if (recentErrors.size() <= 100) {
            return;
        }
        Instant cutoff = now.minus(DEDUP_WINDOW);
        recentErrors.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));
    }

    private void sendSafely(String loggerName, String message, String stackTrace) {
        try {
            String body = buildPayload(loggerName, message, stackTrace);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(webhookUrl))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                log.warn("Slack webhook returned {}: {}",
                        response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.warn("Slack webhook send failed: {}", e.getMessage());
        }
    }

    String buildPayload(String loggerName, String message, String stackTrace)
            throws JsonProcessingException {
        StringBuilder text = new StringBuilder();
        text.append("🚨 *ERROR* on `my-qa-web`\n");
        text.append("*Logger:* `").append(loggerName).append("`\n");
        text.append("*Message:* ").append(message == null ? "" : message);
        if (stackTrace != null && !stackTrace.isEmpty()) {
            String truncated = stackTrace.length() > STACK_TRACE_MAX
                    ? stackTrace.substring(0, STACK_TRACE_MAX) + "\n... (truncated)"
                    : stackTrace;
            text.append("\n```\n").append(truncated).append("\n```");
        }
        return objectMapper.writeValueAsString(Map.of("text", text.toString()));
    }
}
