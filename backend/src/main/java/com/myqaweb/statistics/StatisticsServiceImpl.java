package com.myqaweb.statistics;

import com.myqaweb.feature.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Statistics service implementation — computes reports, trends, and release readiness.
 */
@Service
public class StatisticsServiceImpl implements StatisticsService {

    private static final Logger log = LoggerFactory.getLogger(StatisticsServiceImpl.class);

    private final DailyTestSnapshotRepository snapshotRepository;
    private final TestResultRepository testResultRepository;
    private final TicketRepository ticketRepository;
    private final VersionRepository versionRepository;
    private final VersionPhaseRepository versionPhaseRepository;
    private final ReadinessConfig config;

    public StatisticsServiceImpl(DailyTestSnapshotRepository snapshotRepository,
                                  TestResultRepository testResultRepository,
                                  TicketRepository ticketRepository,
                                  VersionRepository versionRepository,
                                  VersionPhaseRepository versionPhaseRepository,
                                  ReadinessConfig config) {
        this.snapshotRepository = snapshotRepository;
        this.testResultRepository = testResultRepository;
        this.ticketRepository = ticketRepository;
        this.versionRepository = versionRepository;
        this.versionPhaseRepository = versionPhaseRepository;
        this.config = config;
    }

    @Override
    @Transactional(readOnly = true)
    public StatisticsDto.DailyReport getDailyReport(Long phaseId, LocalDate date) {
        return snapshotRepository.findByPhaseIdAndSnapshotDate(phaseId, date)
                .map(this::toReport)
                .orElseGet(() -> computeRealtimeReport(phaseId, date));
    }

    @Override
    @Transactional(readOnly = true)
    public StatisticsDto.TrendData getTrend(Long phaseId, LocalDate from, LocalDate to) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));

        List<DailyTestSnapshotEntity> snapshots =
                snapshotRepository.findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
                        phaseId, from, to);

        List<StatisticsDto.DailyReport> reports = snapshots.stream()
                .map(this::toReport)
                .toList();

        return new StatisticsDto.TrendData(phaseId, phase.getPhaseName(), from, to, reports);
    }

    @Override
    @Transactional(readOnly = true)
    public StatisticsDto.ReleaseReadiness getReleaseReadiness(Long versionId) {
        versionRepository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("Version not found: " + versionId));

        List<StatisticsDto.ReadinessCriterion> criteria = new ArrayList<>();

        // Criterion 1: Highest priority open bugs = 0
        int highestOpen = ticketRepository.countOpenByVersionIdAndPriority(versionId, TicketPriority.HIGHEST);
        criteria.add(new StatisticsDto.ReadinessCriterion(
                "Highest 미해결 버그",
                config.getMaxHighestOpen() + "건 이하",
                highestOpen + "건",
                highestOpen <= config.getMaxHighestOpen()));

        // Criterion 2: High priority open bugs <= 2
        int highOpen = ticketRepository.countOpenByVersionIdAndPriority(versionId, TicketPriority.HIGH);
        criteria.add(new StatisticsDto.ReadinessCriterion(
                "High 미해결 버그",
                config.getMaxHighOpen() + "건 이하",
                highOpen + "건",
                highOpen <= config.getMaxHighOpen()));

        // Criterion 3: Regression phase pass rate >= 98%
        BigDecimal regressionPassRate = computeRegressionPassRate(versionId);
        criteria.add(new StatisticsDto.ReadinessCriterion(
                "Regression Pass Rate",
                config.getMinRegressionPassRate() + "% 이상",
                regressionPassRate + "%",
                regressionPassRate.doubleValue() >= config.getMinRegressionPassRate()));

        // Criterion 4: Aging bugs (informational only)
        LocalDateTime agingThreshold = LocalDateTime.now()
                .minusDays(config.getAgingThresholdDays());
        int agingCount = ticketRepository.countAgingByVersionId(versionId, agingThreshold);
        criteria.add(new StatisticsDto.ReadinessCriterion(
                "Aging 버그 (" + config.getAgingThresholdDays() + "일+)",
                "별도 표시",
                agingCount + "건",
                true));

        boolean ready = criteria.stream()
                .filter(c -> !c.name().startsWith("Aging"))
                .allMatch(StatisticsDto.ReadinessCriterion::passed);

        return new StatisticsDto.ReleaseReadiness(
                ready,
                ready ? "GO" : "NO_GO",
                criteria,
                computeVersionProgress(versionId));
    }

    @Override
    @Transactional(readOnly = true)
    public StatisticsDto.Dashboard getDashboard(Long versionId) {
        return new StatisticsDto.Dashboard(
                getReleaseReadiness(versionId),
                getPhaseTrends(versionId),
                getAgingBugs(versionId),
                getBlockedTcs(versionId));
    }

    private StatisticsDto.DailyReport toReport(DailyTestSnapshotEntity s) {
        return new StatisticsDto.DailyReport(
                s.getPhase().getId(),
                s.getPhase().getPhaseName(),
                s.getSnapshotDate(),
                s.getTotalTc(), s.getPassCount(), s.getFailCount(),
                s.getBlockedCount(), s.getSkippedCount(), s.getRetestCount(), s.getUntestedCount(),
                s.getNewBugCritical(), s.getNewBugMajor(), s.getNewBugMinor(), s.getNewBugTrivial(),
                s.getClosedBugCount(), s.getOpenBugCount(), s.getAgingBugCount(),
                s.getPassRate(), s.getProgressRate());
    }

    private StatisticsDto.DailyReport computeRealtimeReport(Long phaseId, LocalDate date) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));

        List<TestResultEntity> results = testResultRepository.findAllByVersionPhaseId(phaseId);
        int total = results.size();
        int pass = countByStatus(results, RunResultStatus.PASS);
        int fail = countByStatus(results, RunResultStatus.FAIL);
        int blocked = countByStatus(results, RunResultStatus.BLOCKED);
        int skipped = countByStatus(results, RunResultStatus.SKIPPED);
        int retest = countByStatus(results, RunResultStatus.RETEST);
        int untested = countByStatus(results, RunResultStatus.UNTESTED);

        int executed = total - untested;
        BigDecimal passRate = executed > 0
                ? BigDecimal.valueOf(pass * 100.0 / executed).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal progressRate = total > 0
                ? BigDecimal.valueOf(executed * 100.0 / total).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new StatisticsDto.DailyReport(
                phaseId, phase.getPhaseName(), date,
                total, pass, fail, blocked, skipped, retest, untested,
                0, 0, 0, 0, 0, 0, 0,
                passRate, progressRate);
    }

    private BigDecimal computeRegressionPassRate(Long versionId) {
        List<VersionPhaseEntity> regressionPhases = versionPhaseRepository
                .findAllByVersionIdOrderByOrderIndex(versionId).stream()
                .filter(p -> p.getPhaseType() == PhaseType.REGRESSION)
                .toList();

        if (regressionPhases.isEmpty()) {
            return BigDecimal.valueOf(100);
        }

        int totalPass = 0;
        int totalExecuted = 0;
        for (VersionPhaseEntity phase : regressionPhases) {
            List<TestResultEntity> results = testResultRepository.findAllByVersionPhaseId(phase.getId());
            totalPass += countByStatus(results, RunResultStatus.PASS);
            totalExecuted += results.size() - countByStatus(results, RunResultStatus.UNTESTED);
        }

        return totalExecuted > 0
                ? BigDecimal.valueOf(totalPass * 100.0 / totalExecuted).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(100);
    }

    private StatisticsDto.VersionProgressSummary computeVersionProgress(Long versionId) {
        List<TestResultEntity> allResults = testResultRepository.findAllByVersionId(versionId);
        int total = allResults.size();
        int pass = countByStatus(allResults, RunResultStatus.PASS);
        int fail = countByStatus(allResults, RunResultStatus.FAIL);
        int blocked = countByStatus(allResults, RunResultStatus.BLOCKED);
        int untested = countByStatus(allResults, RunResultStatus.UNTESTED);
        int completed = total - untested;

        BigDecimal passRate = completed > 0
                ? BigDecimal.valueOf(pass * 100.0 / completed).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal progressRate = total > 0
                ? BigDecimal.valueOf(completed * 100.0 / total).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new StatisticsDto.VersionProgressSummary(
                total, completed, pass, fail, blocked, passRate, progressRate);
    }

    private List<StatisticsDto.TrendData> getPhaseTrends(Long versionId) {
        List<VersionPhaseEntity> phases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);
        return phases.stream().map(phase -> {
            LocalDate from = phase.getStartDate() != null ? phase.getStartDate() : phase.getCreatedAt().toLocalDate();
            LocalDate to = phase.getEndDate() != null ? phase.getEndDate() : LocalDate.now();
            List<DailyTestSnapshotEntity> snapshots = snapshotRepository
                    .findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(phase.getId(), from, to);
            return new StatisticsDto.TrendData(
                    phase.getId(), phase.getPhaseName(), from, to,
                    snapshots.stream().map(this::toReport).toList());
        }).toList();
    }

    private List<StatisticsDto.AgingBugInfo> getAgingBugs(Long versionId) {
        LocalDateTime threshold = LocalDateTime.now().minusDays(config.getAgingThresholdDays());
        List<TicketEntity> agingTickets = ticketRepository.findAgingByVersionId(versionId, threshold);

        return agingTickets.stream().map(t -> {
            TestResultEntity result = t.getTestResult();
            long agingDays = ChronoUnit.DAYS.between(t.getCreatedAt().toLocalDate(), LocalDate.now());
            return new StatisticsDto.AgingBugInfo(
                    t.getId(), t.getJiraKey(), t.getJiraUrl(),
                    t.getSummary(), t.getPriority(),
                    result.getVersionPhase().getPhaseName(),
                    result.getTestCase().getTitle(),
                    t.getCreatedAt(), agingDays);
        }).toList();
    }

    private List<StatisticsDto.BlockedTcInfo> getBlockedTcs(Long versionId) {
        List<TestResultEntity> blockedResults = testResultRepository
                .findAllByVersionIdAndStatus(versionId, RunResultStatus.BLOCKED);

        return blockedResults.stream().map(r -> {
            Long[] pathArr = r.getTestCase().getPath();
            List<Long> path = pathArr != null ? Arrays.asList(pathArr) : List.of();
            return new StatisticsDto.BlockedTcInfo(
                    r.getId(),
                    r.getTestCase().getId(),
                    r.getTestCase().getTitle(),
                    path,
                    r.getVersionPhase().getPhaseName());
        }).toList();
    }

    private int countByStatus(List<TestResultEntity> results, RunResultStatus status) {
        return (int) results.stream().filter(r -> r.getStatus() == status).count();
    }
}
