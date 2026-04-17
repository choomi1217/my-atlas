package com.myqaweb.statistics;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for release readiness criteria.
 */
@Component
@ConfigurationProperties(prefix = "statistics.readiness")
@Getter
@Setter
public class ReadinessConfig {
    private int maxHighestOpen = 0;
    private int maxHighOpen = 2;
    private double minRegressionPassRate = 98.0;
    private int agingThresholdDays = 3;
}
