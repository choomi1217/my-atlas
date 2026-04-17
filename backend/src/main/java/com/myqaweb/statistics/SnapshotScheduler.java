package com.myqaweb.statistics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Scheduler that creates daily test snapshots at midnight.
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
        LocalDate today = LocalDate.now();
        log.info("Daily snapshot started for date: {}", today);
        snapshotService.createSnapshotsForDate(today);
        log.info("Daily snapshot completed for date: {}", today);
    }
}
