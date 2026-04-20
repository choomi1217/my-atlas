package com.myqaweb.monitoring;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class MonitoringDto {

    public record AiUsageSummary(
            long totalCalls,
            long totalTokens,
            BigDecimal totalCost,
            long successCount,
            long failureCount,
            List<ProviderSummary> byProvider,
            List<FeatureUsage> byFeature
    ) {}

    public record ProviderSummary(
            String provider,
            long calls,
            long tokens,
            BigDecimal cost
    ) {}

    public record FeatureUsage(
            String feature,
            String provider,
            long calls,
            long inputTokens,
            long outputTokens,
            BigDecimal cost,
            double avgDurationMs
    ) {}

    public record DailyTrend(
            LocalDate date,
            long calls,
            long tokens,
            BigDecimal cost
    ) {}

    public record ApiAccessSummary(
            long totalRequests,
            List<FeatureAccessCount> byFeature,
            List<EndpointAccessCount> topEndpoints
    ) {}

    public record FeatureAccessCount(
            String feature,
            long count
    ) {}

    public record EndpointAccessCount(
            String method,
            String uri,
            long count
    ) {}
}
