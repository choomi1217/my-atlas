package com.myqaweb.monitoring;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MonitoringServiceImpl implements MonitoringService {

    private final AiUsageLogRepository aiUsageLogRepository;
    private final ApiAccessLogRepository apiAccessLogRepository;

    @Override
    public MonitoringDto.AiUsageSummary getAiUsageSummary(LocalDateTime from, LocalDateTime to) {
        List<Object[]> rows = aiUsageLogRepository.aggregateByFeatureAndProvider(from, to);

        long totalCalls = 0;
        long totalTokens = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        long successCount = 0;
        long failureCount = 0;

        Map<String, long[]> providerAgg = new LinkedHashMap<>(); // provider -> [calls, tokens, costMicros]
        List<MonitoringDto.FeatureUsage> features = new ArrayList<>();

        for (Object[] row : rows) {
            String feature = (String) row[0];
            String provider = (String) row[1];
            long calls = ((Number) row[2]).longValue();
            long inputTok = ((Number) row[3]).longValue();
            long outputTok = ((Number) row[4]).longValue();
            long tokens = ((Number) row[5]).longValue();
            BigDecimal cost = toBigDecimal(row[6]);
            double avgDuration = ((Number) row[7]).doubleValue();
            long successes = ((Number) row[8]).longValue();
            long failures = ((Number) row[9]).longValue();

            totalCalls += calls;
            totalTokens += tokens;
            totalCost = totalCost.add(cost);
            successCount += successes;
            failureCount += failures;

            providerAgg.merge(provider, new long[]{calls, tokens},
                    (a, b) -> new long[]{a[0] + b[0], a[1] + b[1]});

            features.add(new MonitoringDto.FeatureUsage(
                    feature, provider, calls, inputTok, outputTok, cost, avgDuration));
        }

        List<MonitoringDto.ProviderSummary> providers = new ArrayList<>();
        for (Object[] row : rows) {
            // Re-aggregate at provider level
        }
        // Build provider summaries from providerAgg map
        Map<String, BigDecimal> providerCosts = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String provider = (String) row[1];
            BigDecimal cost = toBigDecimal(row[6]);
            providerCosts.merge(provider, cost, BigDecimal::add);
        }
        for (Map.Entry<String, long[]> entry : providerAgg.entrySet()) {
            providers.add(new MonitoringDto.ProviderSummary(
                    entry.getKey(),
                    entry.getValue()[0],
                    entry.getValue()[1],
                    providerCosts.getOrDefault(entry.getKey(), BigDecimal.ZERO)
            ));
        }

        return new MonitoringDto.AiUsageSummary(
                totalCalls, totalTokens, totalCost,
                successCount, failureCount,
                providers, features
        );
    }

    @Override
    public List<MonitoringDto.DailyTrend> getDailyTrend(LocalDateTime from, LocalDateTime to) {
        List<Object[]> rows = aiUsageLogRepository.dailyTrend(from, to);
        List<MonitoringDto.DailyTrend> result = new ArrayList<>();
        for (Object[] row : rows) {
            LocalDate date = ((Date) row[0]).toLocalDate();
            long calls = ((Number) row[1]).longValue();
            long tokens = ((Number) row[2]).longValue();
            BigDecimal cost = toBigDecimal(row[3]);
            result.add(new MonitoringDto.DailyTrend(date, calls, tokens, cost));
        }
        return result;
    }

    @Override
    public MonitoringDto.ApiAccessSummary getApiAccessSummary(LocalDateTime from, LocalDateTime to) {
        List<Object[]> featureRows = apiAccessLogRepository.countByFeature(from, to);
        List<Object[]> endpointRows = apiAccessLogRepository.topEndpoints(from, to);

        long total = 0;
        List<MonitoringDto.FeatureAccessCount> byFeature = new ArrayList<>();
        for (Object[] row : featureRows) {
            String feature = (String) row[0];
            long count = ((Number) row[1]).longValue();
            total += count;
            byFeature.add(new MonitoringDto.FeatureAccessCount(feature, count));
        }

        List<MonitoringDto.EndpointAccessCount> topEndpoints = new ArrayList<>();
        for (Object[] row : endpointRows) {
            topEndpoints.add(new MonitoringDto.EndpointAccessCount(
                    (String) row[0], (String) row[1], ((Number) row[2]).longValue()));
        }

        return new MonitoringDto.ApiAccessSummary(total, byFeature, topEndpoints);
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }
}
