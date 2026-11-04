package com.myqaweb.statistics;

import com.myqaweb.feature.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for StatisticsServiceImpl — trend/daily-report (registry_v32 Step 1),
 * unresolved FAIL readiness / openFail / failedTcs (Step 2).
 */
@ExtendWith(MockitoExtension.class)
class StatisticsServiceImplTest {

    private static final Long VERSION_ID = 1L;
    private static final Long PHASE_ID = 10L;

    @Mock
    private DailyTestSnapshotRepository snapshotRepository;

    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private VersionRepository versionRepository;

    @Mock
    private VersionPhaseRepository versionPhaseRepository;

    @Mock
    private SnapshotService snapshotService;

    private StatisticsServiceImpl statisticsService;
    private VersionEntity version;
    private VersionPhaseEntity phase;
    private LocalDate today;
    private StatisticsDto.DailyReport live;

    @BeforeEach
    void setUp() {
        statisticsService = new StatisticsServiceImpl(snapshotRepository, testResultRepository,
                ticketRepository, versionRepository, versionPhaseRepository, snapshotService,
                new ReadinessConfig());

        today = LocalDate.now();

        version = new VersionEntity();
        version.setId(VERSION_ID);
        phase = new VersionPhaseEntity();
        phase.setId(PHASE_ID);
        phase.setVersion(version);
        phase.setPhaseName("1차");
        phase.setCreatedAt(today.minusDays(2).atTime(9, 0));

        live = new StatisticsDto.DailyReport(PHASE_ID, "1차", today,
                99, 99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                new BigDecimal("100.00"), new BigDecimal("100.00"));
    }

    private DailyTestSnapshotEntity snapshot(LocalDate date, int passCount) {
        DailyTestSnapshotEntity s = new DailyTestSnapshotEntity();
        s.setPhase(phase);
        s.setVersion(version);
        s.setSnapshotDate(date);
        s.setPassCount(passCount);
        return s;
    }

    /** Stubs everything getDashboard touches for a single-phase version. */
    private void givenDashboardVersion() {
        when(versionRepository.findById(VERSION_ID)).thenReturn(Optional.of(version));
        when(versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(VERSION_ID)).thenReturn(List.of(phase));
    }

    // --- getTrend ---

    @Test
    void testGetTrend_TodayInRange_AppendsLiveAndDropsTodaySnapshot() {
        LocalDate from = today.minusDays(2);
        LocalDate to = today.plusDays(3);
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(snapshotRepository.findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(PHASE_ID, from, to))
                .thenReturn(List.of(snapshot(from, 1), snapshot(today.minusDays(1), 2), snapshot(today, 7)));
        when(snapshotService.compute(PHASE_ID, today)).thenReturn(live);

        StatisticsDto.TrendData trend = statisticsService.getTrend(PHASE_ID, from, to);

        List<StatisticsDto.DailyReport> reports = trend.dailyReports();
        assertEquals(3, reports.size());
        assertEquals(from, reports.get(0).snapshotDate());
        assertEquals(today.minusDays(1), reports.get(1).snapshotDate());
        assertSame(live, reports.get(2));
        assertEquals(1, reports.stream().filter(r -> r.snapshotDate().equals(today)).count());
        assertEquals(from, trend.from());
        assertEquals(to, trend.to());
    }

    @Test
    void testGetTrend_TodayOutOfRange_NoCompute() {
        LocalDate from = today.minusDays(10);
        LocalDate to = today.minusDays(5);
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(snapshotRepository.findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(PHASE_ID, from, to))
                .thenReturn(List.of(snapshot(today.minusDays(6), 3)));

        StatisticsDto.TrendData trend = statisticsService.getTrend(PHASE_ID, from, to);

        assertEquals(1, trend.dailyReports().size());
        assertEquals(3, trend.dailyReports().get(0).passCount());
        verify(snapshotService, never()).compute(any(), any());
    }

    @Test
    void testGetTrend_PhaseNotFound() {
        when(versionPhaseRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> statisticsService.getTrend(99L, today, today));
    }

    // --- getDashboard -> phaseTrends ---

    @Test
    void testGetDashboard_PhaseTrendRangeIsCreatedAtToReleaseDate() {
        version.setReleaseDate(today.plusDays(3));
        givenDashboardVersion();
        when(snapshotService.compute(PHASE_ID, today)).thenReturn(live);

        StatisticsDto.TrendData trend = statisticsService.getDashboard(VERSION_ID).phaseTrends().get(0);

        verify(snapshotRepository).findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
                PHASE_ID, today.minusDays(2), today.plusDays(3));
        assertEquals(today.minusDays(2), trend.from());
        assertEquals(today.plusDays(3), trend.to());
        assertSame(live, trend.dailyReports().get(trend.dailyReports().size() - 1));
    }

    @Test
    void testGetDashboard_PastReleaseDate_NoCompute() {
        phase.setCreatedAt(today.minusDays(5).atTime(9, 0));
        version.setReleaseDate(today.minusDays(1));
        givenDashboardVersion();

        StatisticsDto.TrendData trend = statisticsService.getDashboard(VERSION_ID).phaseTrends().get(0);

        assertEquals(today.minusDays(1), trend.to());
        verify(snapshotService, never()).compute(any(), any());
    }

    @Test
    void testGetDashboard_NoReleaseDate_ToIsToday() {
        givenDashboardVersion();
        when(snapshotService.compute(PHASE_ID, today)).thenReturn(live);

        StatisticsDto.TrendData trend = statisticsService.getDashboard(VERSION_ID).phaseTrends().get(0);

        assertEquals(today, trend.to());
        verify(snapshotRepository).findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
                PHASE_ID, today.minusDays(2), today);
        assertSame(live, trend.dailyReports().get(trend.dailyReports().size() - 1));
    }

    @Test
    void testGetDashboard_StartDateWinsOverCreatedAt() {
        phase.setStartDate(today.minusDays(7));
        version.setReleaseDate(today.plusDays(3));
        givenDashboardVersion();
        when(snapshotService.compute(PHASE_ID, today)).thenReturn(live);

        StatisticsDto.TrendData trend = statisticsService.getDashboard(VERSION_ID).phaseTrends().get(0);

        assertEquals(today.minusDays(7), trend.from());
        verify(snapshotRepository).findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
                PHASE_ID, today.minusDays(7), today.plusDays(3));
    }

    // --- unresolved FAILs: readiness / openFail / failedTcs (registry_v32 Step 2) ---

    private VersionPhaseEntity phaseAt(Long id, int orderIndex) {
        VersionPhaseEntity p = new VersionPhaseEntity();
        p.setId(id);
        p.setVersion(version);
        p.setPhaseName(orderIndex + "차");
        p.setOrderIndex(orderIndex);
        return p;
    }

    private TestResultEntity result(Long id, Long tcId, VersionPhaseEntity p, RunResultStatus status,
                                    TicketPriority priority) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setId(tcId);
        tc.setTitle("TC " + tcId);
        TestResultEntity r = new TestResultEntity();
        r.setId(id);
        r.setVersion(version);
        r.setVersionPhase(p);
        r.setTestCase(tc);
        r.setStatus(status);
        r.setPriority(priority);
        return r;
    }

    private void givenResults(TestResultEntity... results) {
        when(versionRepository.findById(VERSION_ID)).thenReturn(Optional.of(version));
        when(testResultRepository.findAllByVersionId(VERSION_ID)).thenReturn(List.of(results));
    }

    private StatisticsDto.ReadinessCriterion criterion(StatisticsDto.ReleaseReadiness r, String name) {
        return r.criteria().stream().filter(c -> c.name().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void testUnresolved_FailThenPass_IsResolved() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        VersionPhaseEntity p2 = phaseAt(12L, 2);
        // phase 2 listed first to make sure orderIndex, not list order, decides
        givenResults(
                result(2L, 100L, p2, RunResultStatus.PASS, null),
                result(1L, 100L, p1, RunResultStatus.FAIL, TicketPriority.HIGHEST));

        StatisticsDto.Dashboard dashboard = statisticsService.getDashboard(VERSION_ID);

        assertEquals(0, dashboard.releaseReadiness().progress().openFail());
        assertEquals(1, dashboard.releaseReadiness().progress().fail());
        assertTrue(dashboard.failedTcs().isEmpty());
        assertEquals("0건", criterion(dashboard.releaseReadiness(), "Highest 미해결 버그").actual());
    }

    @Test
    void testUnresolved_FailThenUntested_StaysUnresolved() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        VersionPhaseEntity p2 = phaseAt(12L, 2);
        givenResults(
                result(1L, 100L, p1, RunResultStatus.FAIL, TicketPriority.HIGH),
                result(2L, 100L, p2, RunResultStatus.UNTESTED, null));

        StatisticsDto.Dashboard dashboard = statisticsService.getDashboard(VERSION_ID);

        assertEquals(1, dashboard.releaseReadiness().progress().openFail());
        assertEquals(1, dashboard.failedTcs().size());
        assertEquals(1L, dashboard.failedTcs().get(0).testResultId());
        assertEquals(11L, dashboard.failedTcs().get(0).phaseId());
    }

    @Test
    void testUnresolved_PassThenFail_IsUnresolved() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        VersionPhaseEntity p2 = phaseAt(12L, 2);
        TestResultEntity fail = result(2L, 100L, p2, RunResultStatus.FAIL, TicketPriority.MEDIUM);
        fail.setComment("[AI FAIL] #2 FAIL: 버튼 없음");
        givenResults(result(1L, 100L, p1, RunResultStatus.PASS, null), fail);

        StatisticsDto.Dashboard dashboard = statisticsService.getDashboard(VERSION_ID);

        assertEquals(1, dashboard.releaseReadiness().progress().openFail());
        StatisticsDto.FailedTcInfo info = dashboard.failedTcs().get(0);
        assertEquals(2L, info.testResultId());
        assertEquals(100L, info.testCaseId());
        assertEquals("TC 100", info.testCaseTitle());
        assertEquals(12L, info.phaseId());
        assertEquals("2차", info.phaseName());
        assertEquals(TicketPriority.MEDIUM, info.priority());
        assertEquals("[AI FAIL] #2 FAIL: 버튼 없음", info.comment());
        assertEquals(List.of(), info.testCasePath());
    }

    @Test
    void testUnresolved_FailInBothPhases_CountedOncePerTc() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        VersionPhaseEntity p2 = phaseAt(12L, 2);
        givenResults(
                result(1L, 100L, p1, RunResultStatus.FAIL, TicketPriority.HIGH),
                result(2L, 100L, p2, RunResultStatus.FAIL, TicketPriority.LOW));

        StatisticsDto.Dashboard dashboard = statisticsService.getDashboard(VERSION_ID);

        StatisticsDto.VersionProgressSummary progress = dashboard.releaseReadiness().progress();
        assertEquals(2, progress.fail());
        assertEquals(1, progress.openFail());
        assertEquals(1, dashboard.failedTcs().size());
        assertEquals(TicketPriority.LOW, dashboard.failedTcs().get(0).priority());
    }

    @Test
    void testReadiness_HighestAndHighCountedFromResultPriority() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        givenResults(
                result(1L, 101L, p1, RunResultStatus.FAIL, TicketPriority.HIGHEST),
                result(2L, 102L, p1, RunResultStatus.FAIL, TicketPriority.HIGH),
                result(3L, 103L, p1, RunResultStatus.FAIL, TicketPriority.HIGH),
                result(4L, 104L, p1, RunResultStatus.FAIL, TicketPriority.HIGH),
                result(5L, 105L, p1, RunResultStatus.FAIL, TicketPriority.MEDIUM));

        StatisticsDto.ReleaseReadiness readiness = statisticsService.getReleaseReadiness(VERSION_ID);

        StatisticsDto.ReadinessCriterion highest = criterion(readiness, "Highest 미해결 버그");
        assertEquals("1건", highest.actual());
        assertFalse(highest.passed());
        StatisticsDto.ReadinessCriterion high = criterion(readiness, "High 미해결 버그");
        assertEquals("3건", high.actual());
        assertFalse(high.passed());
        assertFalse(readiness.ready());
        assertEquals("NO_GO", readiness.verdict());
        verify(ticketRepository, never()).countOpenByVersionIdAndPriority(any(), any());
    }

    @Test
    void testReadiness_HighWithinLimit_Passes() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        givenResults(
                result(1L, 101L, p1, RunResultStatus.FAIL, TicketPriority.HIGH),
                result(2L, 102L, p1, RunResultStatus.FAIL, TicketPriority.HIGH));

        StatisticsDto.ReleaseReadiness readiness = statisticsService.getReleaseReadiness(VERSION_ID);

        assertEquals("2건", criterion(readiness, "High 미해결 버그").actual());
        assertTrue(criterion(readiness, "High 미해결 버그").passed());
        assertTrue(readiness.ready());
    }

    @Test
    void testReadiness_OneUnknownPriority_NoGo() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        givenResults(
                result(1L, 101L, p1, RunResultStatus.FAIL, null),
                result(2L, 102L, p1, RunResultStatus.PASS, null));

        StatisticsDto.ReleaseReadiness readiness = statisticsService.getReleaseReadiness(VERSION_ID);

        StatisticsDto.ReadinessCriterion unconfirmed = criterion(readiness, "Priority 확인 필요");
        assertEquals("0건 이하", unconfirmed.threshold());
        assertEquals("1건", unconfirmed.actual());
        assertFalse(unconfirmed.passed());
        assertTrue(criterion(readiness, "Highest 미해결 버그").passed());
        assertTrue(criterion(readiness, "High 미해결 버그").passed());
        assertFalse(readiness.ready());
        assertEquals("NO_GO", readiness.verdict());
    }

    @Test
    void testReadiness_NoUnknownAndOtherCriteriaMet_Go() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        givenResults(
                result(1L, 101L, p1, RunResultStatus.FAIL, TicketPriority.MEDIUM),
                result(2L, 102L, p1, RunResultStatus.PASS, null));

        StatisticsDto.ReleaseReadiness readiness = statisticsService.getReleaseReadiness(VERSION_ID);

        assertEquals("0건", criterion(readiness, "Priority 확인 필요").actual());
        assertTrue(criterion(readiness, "Priority 확인 필요").passed());
        assertTrue(readiness.ready());
        assertEquals("GO", readiness.verdict());
        assertEquals(1, readiness.progress().openFail());
    }

    @Test
    void testReadiness_UnknownResolvedByLaterPass_Go() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        VersionPhaseEntity p2 = phaseAt(12L, 2);
        givenResults(
                result(1L, 101L, p1, RunResultStatus.FAIL, null),
                result(2L, 101L, p2, RunResultStatus.PASS, null));

        StatisticsDto.ReleaseReadiness readiness = statisticsService.getReleaseReadiness(VERSION_ID);

        assertEquals("0건", criterion(readiness, "Priority 확인 필요").actual());
        assertEquals("GO", readiness.verdict());
    }

    @Test
    void testDashboard_FailedTcsSortedUnknownFirstThenHighestToLowest() {
        VersionPhaseEntity p1 = phaseAt(11L, 1);
        givenResults(
                result(1L, 101L, p1, RunResultStatus.FAIL, TicketPriority.LOWEST),
                result(2L, 102L, p1, RunResultStatus.FAIL, TicketPriority.MEDIUM),
                result(3L, 103L, p1, RunResultStatus.FAIL, null),
                result(4L, 104L, p1, RunResultStatus.FAIL, TicketPriority.HIGHEST),
                result(5L, 105L, p1, RunResultStatus.FAIL, TicketPriority.LOW),
                result(6L, 106L, p1, RunResultStatus.FAIL, TicketPriority.HIGH));

        List<StatisticsDto.FailedTcInfo> failed = statisticsService.getDashboard(VERSION_ID).failedTcs();

        assertEquals(Arrays.asList(null, TicketPriority.HIGHEST, TicketPriority.HIGH, TicketPriority.MEDIUM,
                        TicketPriority.LOW, TicketPriority.LOWEST),
                failed.stream().map(StatisticsDto.FailedTcInfo::priority).toList());
        assertEquals(103L, failed.get(0).testCaseId());
    }

    // --- getDailyReport ---

    @Test
    void testGetDailyReport_Today_ComputesLive() {
        when(snapshotService.compute(PHASE_ID, today)).thenReturn(live);

        assertSame(live, statisticsService.getDailyReport(PHASE_ID, today));
        verifyNoInteractions(snapshotRepository);
    }

    @Test
    void testGetDailyReport_PastWithSnapshot_ReturnsSnapshot() {
        LocalDate past = today.minusDays(3);
        when(snapshotRepository.findByPhaseIdAndSnapshotDate(PHASE_ID, past))
                .thenReturn(Optional.of(snapshot(past, 7)));

        StatisticsDto.DailyReport r = statisticsService.getDailyReport(PHASE_ID, past);

        assertEquals(PHASE_ID, r.phaseId());
        assertEquals(past, r.snapshotDate());
        assertEquals(7, r.passCount());
        verify(snapshotService, never()).compute(any(), any());
    }

    @Test
    void testGetDailyReport_PastWithoutSnapshot_ComputesLive() {
        LocalDate past = today.minusDays(3);
        when(snapshotRepository.findByPhaseIdAndSnapshotDate(PHASE_ID, past)).thenReturn(Optional.empty());
        when(snapshotService.compute(PHASE_ID, past)).thenReturn(live);

        assertSame(live, statisticsService.getDailyReport(PHASE_ID, past));
    }
}
