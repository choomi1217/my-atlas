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
import java.util.List;

/**
 * Service implementation for creating daily test snapshots.
 */
@Service
public class SnapshotServiceImpl implements SnapshotService {

    private static final Logger log = LoggerFactory.getLogger(SnapshotServiceImpl.class);

    private final TestResultRepository testResultRepository;
    private final TicketRepository ticketRepository;
    private final VersionPhaseRepository versionPhaseRepository;
    private final DailyTestSnapshotRepository snapshotRepository;
    private final ReadinessConfig config;

    public SnapshotServiceImpl(TestResultRepository testResultRepository,
                               TicketRepository ticketRepository,
                               VersionPhaseRepository versionPhaseRepository,
                               DailyTestSnapshotRepository snapshotRepository,
                               ReadinessConfig config) {
        this.testResultRepository = testResultRepository;
        this.ticketRepository = ticketRepository;
        this.versionPhaseRepository = versionPhaseRepository;
        this.snapshotRepository = snapshotRepository;
        this.config = config;
    }

    @Override
    @Transactional
    public void createSnapshot(Long phaseId, LocalDate date) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));
        Long versionId = phase.getVersion().getId();

        // 1. TC execution stats
        List<TestResultEntity> results = testResultRepository.findAllByVersionPhaseId(phaseId);
        int total = results.size();
        int pass = countByStatus(results, RunResultStatus.PASS);
        int fail = countByStatus(results, RunResultStatus.FAIL);
        int blocked = countByStatus(results, RunResultStatus.BLOCKED);
        int skipped = countByStatus(results, RunResultStatus.SKIPPED);
        int retest = countByStatus(results, RunResultStatus.RETEST);
        int untested = countByStatus(results, RunResultStatus.UNTESTED);

        // 2. Bug stats from tickets linked to this phase's results
        List<Long> resultIds = results.stream().map(TestResultEntity::getId).toList();
        List<TicketEntity> allTickets = resultIds.isEmpty()
                ? List.of()
                : ticketRepository.findAllByTestResultIdIn(resultIds);

        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

        int newCritical = countNewByPriorityOnDate(allTickets, TicketPriority.HIGHEST, dayStart, dayEnd);
        int newMajor = countNewByPriorityOnDate(allTickets, TicketPriority.HIGH, dayStart, dayEnd);
        int newMinor = countNewByPriorityOnDate(allTickets, TicketPriority.MEDIUM, dayStart, dayEnd);
        int newTrivial = countNewByPriorityOnDate(allTickets, TicketPriority.LOW, dayStart, dayEnd)
                + countNewByPriorityOnDate(allTickets, TicketPriority.LOWEST, dayStart, dayEnd);

        int closed = (int) allTickets.stream()
                .filter(t -> t.getClosedAt() != null
                        && !t.getClosedAt().isBefore(dayStart)
                        && t.getClosedAt().isBefore(dayEnd))
                .count();

        int open = (int) allTickets.stream()
                .filter(t -> t.getClosedAt() == null)
                .count();

        LocalDateTime agingThreshold = date.minusDays(config.getAgingThresholdDays()).atStartOfDay();
        int aging = (int) allTickets.stream()
                .filter(t -> t.getClosedAt() == null)
                .filter(t -> t.getCreatedAt().isBefore(agingThreshold.plusDays(1)))
                .count();

        // 3. Rates
        int executed = total - untested;
        BigDecimal passRate = executed > 0
                ? BigDecimal.valueOf(pass * 100.0 / executed).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal progressRate = total > 0
                ? BigDecimal.valueOf(executed * 100.0 / total).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 4. Upsert (idempotent)
        snapshotRepository.upsertSnapshot(
                versionId, phaseId, date,
                total, pass, fail, blocked, skipped, retest, untested,
                newCritical, newMajor, newMinor, newTrivial,
                closed, open, aging,
                passRate, progressRate);

        log.debug("Snapshot created for phase {} on {}", phaseId, date);
    }

    @Override
    @Transactional
    public void createSnapshotsForDate(LocalDate date) {
        List<VersionPhaseEntity> activePhases = versionPhaseRepository.findAll().stream()
                .filter(p -> p.getEndDate() == null || !p.getEndDate().isBefore(date))
                .toList();

        log.info("Creating snapshots for {} active phases on {}", activePhases.size(), date);

        for (VersionPhaseEntity phase : activePhases) {
            try {
                createSnapshot(phase.getId(), date);
            } catch (Exception e) {
                log.error("Failed to create snapshot for phase {} on {}", phase.getId(), date, e);
            }
        }
    }

    private int countByStatus(List<TestResultEntity> results, RunResultStatus status) {
        return (int) results.stream().filter(r -> r.getStatus() == status).count();
    }

    private int countNewByPriorityOnDate(List<TicketEntity> tickets, TicketPriority priority,
                                          LocalDateTime dayStart, LocalDateTime dayEnd) {
        return (int) tickets.stream()
                .filter(t -> t.getPriority() == priority)
                .filter(t -> !t.getCreatedAt().isBefore(dayStart) && t.getCreatedAt().isBefore(dayEnd))
                .count();
    }
}
