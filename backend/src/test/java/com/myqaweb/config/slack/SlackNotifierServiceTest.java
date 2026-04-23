package com.myqaweb.config.slack;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SlackNotifierServiceTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
    }

    @Test
    void disabledWhenWebhookBlank() {
        SlackNotifierService svc = new SlackNotifierService("", objectMapper);
        assertFalse(svc.isEnabled());
        // Must be callable without throwing even when disabled.
        svc.notify("logger", "msg", null);
    }

    @Test
    void disabledWhenWebhookNull() {
        SlackNotifierService svc = new SlackNotifierService(null, objectMapper);
        assertFalse(svc.isEnabled());
    }

    @Test
    void disabledWhenWebhookWhitespace() {
        SlackNotifierService svc = new SlackNotifierService("   ", objectMapper);
        assertFalse(svc.isEnabled());
    }

    @Test
    void enabledWhenWebhookSet() {
        SlackNotifierService svc = new SlackNotifierService(
                "https://hooks.slack.com/services/T/B/xxx", objectMapper);
        assertTrue(svc.isEnabled());
    }

    @Test
    void rateLimitAcceptsFirstFiveAndRejectsSixth() {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        for (int i = 1; i <= SlackNotifierService.MAX_PER_MINUTE; i++) {
            assertTrue(svc.acquireSlot(), "call " + i + " should be allowed");
        }
        assertFalse(svc.acquireSlot(), "call beyond limit should be rejected");
    }

    @Test
    void dedupBlocksIdenticalMessageWithinWindow() {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        String logger = "com.example.Foo";
        String message = "boom";
        assertFalse(svc.isDuplicate(logger, message), "first call should not be duplicate");
        assertTrue(svc.isDuplicate(logger, message), "second call within window is duplicate");
    }

    @Test
    void dedupDoesNotBlockDifferentLoggers() {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        assertFalse(svc.isDuplicate("com.a.Foo", "msg"));
        assertFalse(svc.isDuplicate("com.b.Bar", "msg"));
    }

    @Test
    void dedupDoesNotBlockDifferentMessages() {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        assertFalse(svc.isDuplicate("logger", "msg-1"));
        assertFalse(svc.isDuplicate("logger", "msg-2"));
    }

    @Test
    void payloadIncludesLoggerAndMessage() throws Exception {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        String body = svc.buildPayload("com.example.Foo", "something broke", null);
        JsonNode root = objectMapper.readTree(body);
        String text = root.get("text").asText();
        assertTrue(text.contains("ERROR"));
        assertTrue(text.contains("com.example.Foo"));
        assertTrue(text.contains("something broke"));
    }

    @Test
    void payloadTruncatesLongStackTrace() throws Exception {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        String longTrace = "x".repeat(SlackNotifierService.STACK_TRACE_MAX + 500);
        String body = svc.buildPayload("logger", "msg", longTrace);
        JsonNode root = objectMapper.readTree(body);
        String text = root.get("text").asText();
        assertTrue(text.contains("(truncated)"));
        // Raw stacktrace beyond limit must be absent.
        int xCount = text.length() - text.replace("x", "").length();
        assertTrue(xCount <= SlackNotifierService.STACK_TRACE_MAX,
                "only up to STACK_TRACE_MAX x-chars expected, got " + xCount);
    }

    @Test
    void payloadHandlesNullMessage() throws Exception {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        String body = svc.buildPayload("logger", null, null);
        JsonNode root = objectMapper.readTree(body);
        assertNotNull(root.get("text").asText());
    }

    @Test
    void payloadOmitsStackTraceBlockWhenAbsent() throws Exception {
        SlackNotifierService svc = new SlackNotifierService("https://x", objectMapper);
        String body = svc.buildPayload("logger", "msg", null);
        assertFalse(body.contains("```"));
    }
}
