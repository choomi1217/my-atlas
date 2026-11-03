package com.myqaweb.feature;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Scheduler that purges old agent_step_screenshot rows to prevent unbounded growth (registry_v31).
 * Only agent_step_screenshot is targeted — knowledge_base and pdf_upload_job
 * must never be touched by this or any other cleanup job.
 */
@Component
public class AgentArtifactRetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(AgentArtifactRetentionScheduler.class);

    private final AgentStepScreenshotRepository repository;
    private final int retentionDays;

    public AgentArtifactRetentionScheduler(
            AgentStepScreenshotRepository repository,
            @Value("${agent.artifact.retention.days:30}") int retentionDays) {
        this.repository = repository;
        this.retentionDays = retentionDays;
    }

    /**
     * Runs at 03:40 daily, offset from AccessLogRetentionScheduler's 03:30 run.
     * {@code @Transactional} sits on this method rather than a helper because a
     * self-invoked helper would bypass the proxy, leaving the @Modifying delete
     * without a transaction.
     */
    @Scheduled(cron = "0 40 3 * * *")
    @Transactional
    public void purgeOldArtifacts() {
        // Doubles as the off switch (days=0) and as the guard
        // against a misconfigured value wiping the whole table.
        if (retentionDays <= 0) {
            log.info("Agent artifact retention skipped: retention days must be positive but was {}", retentionDays);
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        log.info("Agent artifact retention deleted {} screenshots older than {}", repository.deleteOlderThan(cutoff), cutoff);
    }
}
