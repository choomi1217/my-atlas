package com.myqaweb.statistics;

import java.time.LocalDate;

/**
 * Service for computing and querying test statistics.
 */
public interface StatisticsService {

    /**
     * Gets the daily report for a specific phase on a given date.
     */
    StatisticsDto.DailyReport getDailyReport(Long phaseId, LocalDate date);

    /**
     * Gets trend data for a phase over a date range.
     */
    StatisticsDto.TrendData getTrend(Long phaseId, LocalDate from, LocalDate to);

    /**
     * Evaluates release readiness for a version.
     */
    StatisticsDto.ReleaseReadiness getReleaseReadiness(Long versionId);

    /**
     * Gets the full dashboard data for a version.
     */
    StatisticsDto.Dashboard getDashboard(Long versionId);
}
