package com.myqaweb.statistics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Scheduler that snapshots the previous day's final test state at midnight.
 */
@Component
public class SnapshotScheduler {

    private static final Logger log = LoggerFactory.getLogger(SnapshotScheduler.class);

    private final SnapshotService snapshotService;

    public SnapshotScheduler(SnapshotService snapshotService) {
        this.snapshotService = snapshotService;
    }

    @Scheduled(cron = "0 0 0 * * *")
    public void dailySnapshot() {
        // Records the final state of the day that just ended; today's values are computed live (StatisticsServiceImpl).
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("Daily snapshot started for date: {}", yesterday);
        snapshotService.createSnapshotsForDate(yesterday);
        log.info("Daily snapshot completed for date: {}", yesterday);
    }
}
