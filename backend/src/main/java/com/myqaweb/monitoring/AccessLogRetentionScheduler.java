package com.myqaweb.monitoring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Scheduler that purges old rows from api_access_log to prevent unbounded growth.
 * v36: only api_access_log is targeted here — knowledge_base and pdf_upload_job
 * must never be touched by this or any other cleanup job.
 */
@Component
public class AccessLogRetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(AccessLogRetentionScheduler.class);

    private final ApiAccessLogRepository repository;
    private final boolean retentionEnabled;
    private final int retentionDays;

    public AccessLogRetentionScheduler(
            ApiAccessLogRepository repository,
            @Value("${monitoring.access-log.retention.enabled:true}") boolean retentionEnabled,
            @Value("${monitoring.access-log.retention.days:90}") int retentionDays) {
        this.repository = repository;
        this.retentionEnabled = retentionEnabled;
        this.retentionDays = retentionDays;
    }

    /**
     * Runs at 03:30 daily, offset from SnapshotScheduler's midnight run.
     * {@code @Transactional} sits on this method rather than a helper because a
     * self-invoked helper would bypass the proxy, leaving the @Modifying delete
     * without a transaction.
     */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeOldAccessLogs() {
        if (!retentionEnabled) {
            log.info("Access log retention is disabled, skipping");
            return;
        }
        // Guard against a misconfigured value wiping the whole table.
        if (retentionDays <= 0) {
            log.warn("Access log retention skipped: retention days must be positive but was {}", retentionDays);
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        log.info("Access log retention started, deleting rows older than {}", cutoff);
        int deleted = repository.deleteOlderThan(cutoff);
        log.info("Access log retention completed, deleted {} rows", deleted);
    }
}
