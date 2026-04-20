package com.myqaweb.monitoring;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for querying aggregated monitoring statistics.
 */
public interface MonitoringService {

    MonitoringDto.AiUsageSummary getAiUsageSummary(LocalDateTime from, LocalDateTime to);

    List<MonitoringDto.DailyTrend> getDailyTrend(LocalDateTime from, LocalDateTime to);

    MonitoringDto.ApiAccessSummary getApiAccessSummary(LocalDateTime from, LocalDateTime to);
}
