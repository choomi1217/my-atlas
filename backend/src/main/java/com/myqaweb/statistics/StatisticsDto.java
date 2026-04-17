package com.myqaweb.statistics;

import com.myqaweb.feature.TicketPriority;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for statistics API responses.
 */
public class StatisticsDto {

    public record DailyReport(
            Long phaseId,
            String phaseName,
            LocalDate snapshotDate,
            Integer totalTc,
            Integer passCount,
            Integer failCount,
            Integer blockedCount,
            Integer skippedCount,
            Integer retestCount,
            Integer untestedCount,
            Integer newBugCritical,
            Integer newBugMajor,
            Integer newBugMinor,
            Integer newBugTrivial,
            Integer closedBugCount,
            Integer openBugCount,
            Integer agingBugCount,
            BigDecimal passRate,
            BigDecimal progressRate
    ) {}

    public record TrendData(
            Long phaseId,
            String phaseName,
            LocalDate from,
            LocalDate to,
            List<DailyReport> dailyReports
    ) {}

    public record ReleaseReadiness(
            boolean ready,
            String verdict,
            List<ReadinessCriterion> criteria,
            VersionProgressSummary progress
    ) {}

    public record ReadinessCriterion(
            String name,
            String threshold,
            String actual,
            boolean passed
    ) {}

    public record VersionProgressSummary(
            Integer totalTc,
            Integer completed,
            Integer pass,
            Integer fail,
            Integer blocked,
            BigDecimal overallPassRate,
            BigDecimal overallProgressRate
    ) {}

    public record Dashboard(
            ReleaseReadiness releaseReadiness,
            List<TrendData> phaseTrends,
            List<AgingBugInfo> agingBugs,
            List<BlockedTcInfo> blockedTcs
    ) {}

    public record AgingBugInfo(
            Long ticketId,
            String jiraKey,
            String jiraUrl,
            String summary,
            TicketPriority priority,
            String phaseName,
            String testCaseTitle,
            LocalDateTime createdAt,
            long agingDays
    ) {}

    public record BlockedTcInfo(
            Long testResultId,
            Long testCaseId,
            String testCaseTitle,
            List<Long> testCasePath,
            String phaseName
    ) {}
}
