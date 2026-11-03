package com.myqaweb.statistics;

import com.myqaweb.feature.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for StatisticsServiceImpl trend/daily-report logic (registry_v32 Step 1).
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
