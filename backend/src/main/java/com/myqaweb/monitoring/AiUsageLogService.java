package com.myqaweb.monitoring;

/**
 * Service for logging AI API usage (token consumption and costs).
 */
public interface AiUsageLogService {

    /**
     * Logs an AI API call asynchronously.
     *
     * @param feature       which feature triggered the call
     * @param provider      API provider (ANTHROPIC or OPENAI)
     * @param model         model identifier
     * @param inputTokens   input/prompt token count (null if unavailable)
     * @param outputTokens  output/generation token count (null if unavailable)
     * @param durationMs    wall-clock duration of the API call
     * @param success       whether the call succeeded
     * @param errorMessage  error message if failed (null on success)
     */
    void logUsage(AiFeature feature, String provider, String model,
                  Integer inputTokens, Integer outputTokens,
                  long durationMs, boolean success, String errorMessage);

    /**
     * Logs an AI API call asynchronously with IP address metadata.
     * IP must be captured on the caller thread before @Async dispatch.
     */
    void logUsage(AiFeature feature, String provider, String model,
                  Integer inputTokens, Integer outputTokens,
                  long durationMs, boolean success, String errorMessage,
                  String ipAddress);
}
