package com.myqaweb.monitoring;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiUsageLogServiceImpl implements AiUsageLogService {

    private static final Logger log = LoggerFactory.getLogger(AiUsageLogServiceImpl.class);

    /**
     * Cost per million tokens: [inputCostPerMTok, outputCostPerMTok]
     */
    private static final Map<String, BigDecimal[]> COST_TABLE = Map.of(
            "claude-haiku-4-5-20251001", new BigDecimal[]{
                    new BigDecimal("1.00"), new BigDecimal("5.00")
            },
            "text-embedding-3-small", new BigDecimal[]{
                    new BigDecimal("0.02"), BigDecimal.ZERO
            }
    );

    private static final BigDecimal ONE_MILLION = new BigDecimal("1000000");

    private final AiUsageLogRepository repository;

    @Async
    @Override
    public void logUsage(AiFeature feature, String provider, String model,
                         Integer inputTokens, Integer outputTokens,
                         long durationMs, boolean success, String errorMessage) {
        try {
            AiUsageLogEntity entity = new AiUsageLogEntity();
            entity.setFeature(feature.name());
            entity.setProvider(provider);
            entity.setModel(model);
            entity.setInputTokens(inputTokens);
            entity.setOutputTokens(outputTokens);
            entity.setTotalTokens(safeSum(inputTokens, outputTokens));
            entity.setEstimatedCost(calculateCost(model, inputTokens, outputTokens));
            entity.setDurationMs(durationMs);
            entity.setSuccess(success);
            entity.setErrorMessage(truncate(errorMessage, 500));
            entity.setUsername(getCurrentUsername());
            entity.setCreatedAt(LocalDateTime.now());

            repository.save(entity);
        } catch (Exception e) {
            log.warn("Failed to log AI usage for feature={}: {}", feature, e.getMessage());
        }
    }

    BigDecimal calculateCost(String model, Integer inputTokens, Integer outputTokens) {
        BigDecimal[] rates = COST_TABLE.get(model);
        if (rates == null || (inputTokens == null && outputTokens == null)) {
            return BigDecimal.ZERO;
        }

        BigDecimal inputCost = BigDecimal.ZERO;
        BigDecimal outputCost = BigDecimal.ZERO;

        if (inputTokens != null) {
            inputCost = rates[0].multiply(BigDecimal.valueOf(inputTokens))
                    .divide(ONE_MILLION, 6, RoundingMode.HALF_UP);
        }
        if (outputTokens != null && rates.length > 1) {
            outputCost = rates[1].multiply(BigDecimal.valueOf(outputTokens))
                    .divide(ONE_MILLION, 6, RoundingMode.HALF_UP);
        }

        return inputCost.add(outputCost);
    }

    private Integer safeSum(Integer a, Integer b) {
        if (a == null && b == null) return null;
        return (a != null ? a : 0) + (b != null ? b : 0);
    }

    private String getCurrentUsername() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                return auth.getName();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() <= maxLen ? s : s.substring(0, maxLen);
    }
}
