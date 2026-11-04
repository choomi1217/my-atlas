package com.myqaweb.statistics;

import com.myqaweb.feature.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SnapshotServiceImpl (registry_v32 Step 1).
 */
@ExtendWith(MockitoExtension.class)
class SnapshotServiceImplTest {

    private static final Long VERSION_ID = 1L;
    private static final Long PHASE_ID = 10L;
    private static final LocalDate D = LocalDate.of(2026, 11, 4);

    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private VersionPhaseRepository versionPhaseRepository;

    @Mock
    private DailyTestSnapshotRepository snapshotRepository;

    private SnapshotServiceImpl snapshotService;
    private VersionPhaseEntity phase;

    @BeforeEach
    void setUp() {
        snapshotService = new SnapshotServiceImpl(testResultRepository, ticketRepository,
                versionPhaseRepository, snapshotRepository, new ReadinessConfig());

        VersionEntity version = new VersionEntity();
        version.setId(VERSION_ID);
        phase = new VersionPhaseEntity();
        phase.setId(PHASE_ID);
        phase.setVersion(version);
        phase.setPhaseName("1차");
    }

    private List<TestResultEntity> results(RunResultStatus... statuses) {
        List<TestResultEntity> list = new ArrayList<>();
        for (int i = 0; i < statuses.length; i++) {
            TestResultEntity r = new TestResultEntity();
            r.setId((long) (i + 1));
            r.setStatus(statuses[i]);
            list.add(r);
        }
        return list;
    }

    private TicketEntity ticket(TicketPriority priority, LocalDateTime createdAt, LocalDateTime closedAt) {
        TicketEntity t = new TicketEntity();
        t.setPriority(priority);
        t.setCreatedAt(createdAt);
        t.setClosedAt(closedAt);
        return t;
    }

    /** Phase with one PASS result; the given tickets are linked to it. */
    private void givenTickets(TicketEntity... tickets) {
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(testResultRepository.findAllByVersionPhaseId(PHASE_ID)).thenReturn(results(RunResultStatus.PASS));
        when(ticketRepository.findAllByTestResultIdIn(List.of(1L))).thenReturn(List.of(tickets));
    }

    @Test
    void testCompute_CountsByStatusAndRates() {
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(testResultRepository.findAllByVersionPhaseId(PHASE_ID)).thenReturn(results(
                RunResultStatus.PASS, RunResultStatus.PASS, RunResultStatus.FAIL,
                RunResultStatus.RETEST, RunResultStatus.UNTESTED));
        when(ticketRepository.findAllByTestResultIdIn(List.of(1L, 2L, 3L, 4L, 5L))).thenReturn(List.of());

        StatisticsDto.DailyReport r = snapshotService.compute(PHASE_ID, D);

        assertEquals(PHASE_ID, r.phaseId());
        assertEquals("1차", r.phaseName());
        assertEquals(D, r.snapshotDate());
        assertEquals(5, r.totalTc());
        assertEquals(2, r.passCount());
        assertEquals(1, r.failCount());
        assertEquals(0, r.blockedCount());
        assertEquals(0, r.skippedCount());
        assertEquals(1, r.retestCount());
        assertEquals(1, r.untestedCount());
        assertEquals(new BigDecimal("50.00"), r.passRate());
        assertEquals(new BigDecimal("80.00"), r.progressRate());
        verifyNoInteractions(snapshotRepository);
    }

    @Test
    void testCompute_PassRateRoundsHalfUp() {
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(testResultRepository.findAllByVersionPhaseId(PHASE_ID)).thenReturn(results(
                RunResultStatus.PASS, RunResultStatus.PASS, RunResultStatus.FAIL));
        when(ticketRepository.findAllByTestResultIdIn(anyList())).thenReturn(List.of());

        StatisticsDto.DailyReport r = snapshotService.compute(PHASE_ID, D);

        assertEquals(new BigDecimal("66.67"), r.passRate());
        assertEquals(new BigDecimal("100.00"), r.progressRate());
    }

    @Test
    void testCompute_NewBugsOnlyWithinDay() {
        givenTickets(
                ticket(TicketPriority.HIGHEST, D.atTime(10, 0), null),
                ticket(TicketPriority.HIGH, D.atTime(23, 59), null),
                ticket(TicketPriority.MEDIUM, D.atStartOfDay(), null),
                ticket(TicketPriority.LOW, D.atTime(12, 0), null),
                ticket(TicketPriority.LOWEST, D.atTime(13, 0), null),
                // outside D — must not count as new
                ticket(TicketPriority.HIGHEST, D.minusDays(1).atTime(23, 59), null),
                ticket(TicketPriority.HIGHEST, D.plusDays(1).atStartOfDay(), null),
                ticket(TicketPriority.HIGH, D.minusDays(1).atTime(23, 59), null),
                ticket(TicketPriority.LOW, D.plusDays(1).atStartOfDay(), null));

        StatisticsDto.DailyReport r = snapshotService.compute(PHASE_ID, D);

        assertEquals(1, r.newBugCritical());
        assertEquals(1, r.newBugMajor());
        assertEquals(1, r.newBugMinor());
        assertEquals(2, r.newBugTrivial());
    }

    @Test
    void testCompute_ClosedOpenAndAging() {
        givenTickets(
                ticket(TicketPriority.HIGH, D.minusDays(1).atTime(9, 0), D.atTime(15, 0)),  // closed on D
                ticket(TicketPriority.HIGH, D.minusDays(2).atTime(9, 0), D.minusDays(1).atTime(9, 0)), // closed before D
                ticket(TicketPriority.MEDIUM, D.atTime(9, 0), null),                         // open, fresh
                ticket(TicketPriority.MEDIUM, D.minusDays(5).atTime(9, 0), null));           // open, aging

        StatisticsDto.DailyReport r = snapshotService.compute(PHASE_ID, D);

        assertEquals(1, r.closedBugCount());
        assertEquals(2, r.openBugCount());
        assertEquals(1, r.agingBugCount());
    }

    @Test
    void testCompute_NoResults_ZeroRatesAndNoTicketLookup() {
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(testResultRepository.findAllByVersionPhaseId(PHASE_ID)).thenReturn(List.of());

        StatisticsDto.DailyReport r = snapshotService.compute(PHASE_ID, D);

        assertEquals(0, r.totalTc());
        assertEquals(BigDecimal.ZERO, r.passRate());
        assertEquals(BigDecimal.ZERO, r.progressRate());
        assertEquals(0, r.openBugCount());
        verifyNoInteractions(ticketRepository);
    }

    @Test
    void testCompute_PhaseNotFound() {
        when(versionPhaseRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> snapshotService.compute(99L, D));
        verifyNoInteractions(testResultRepository);
    }

    @Test
    void testCreateSnapshot_UpsertsComputedValues() {
        when(versionPhaseRepository.findById(PHASE_ID)).thenReturn(Optional.of(phase));
        when(testResultRepository.findAllByVersionPhaseId(PHASE_ID)).thenReturn(results(
                RunResultStatus.PASS, RunResultStatus.PASS, RunResultStatus.FAIL,
                RunResultStatus.RETEST, RunResultStatus.UNTESTED));
        when(ticketRepository.findAllByTestResultIdIn(anyList())).thenReturn(List.of(
                ticket(TicketPriority.HIGHEST, D.atTime(10, 0), null)));

        snapshotService.createSnapshot(PHASE_ID, D);

        verify(snapshotRepository).upsertSnapshot(
                VERSION_ID, PHASE_ID, D,
                5, 2, 1, 0, 0, 1, 1,
                1, 0, 0, 0,
                0, 1, 0,
                new BigDecimal("50.00"), new BigDecimal("80.00"));
    }

    @Test
    void testCreateSnapshot_PhaseNotFound() {
        when(versionPhaseRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> snapshotService.createSnapshot(99L, D));
        verifyNoInteractions(snapshotRepository);
    }
}
