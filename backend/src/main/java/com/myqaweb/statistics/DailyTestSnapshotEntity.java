package com.myqaweb.statistics;

import com.myqaweb.feature.VersionEntity;
import com.myqaweb.feature.VersionPhaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Daily snapshot of test execution and bug statistics per phase.
 */
@Entity
@Table(name = "daily_test_snapshot")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyTestSnapshotEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id", nullable = false)
    private VersionEntity version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id", nullable = false)
    private VersionPhaseEntity phase;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "total_tc", nullable = false)
    private Integer totalTc = 0;

    @Column(name = "pass_count", nullable = false)
    private Integer passCount = 0;

    @Column(name = "fail_count", nullable = false)
    private Integer failCount = 0;

    @Column(name = "blocked_count", nullable = false)
    private Integer blockedCount = 0;

    @Column(name = "skipped_count", nullable = false)
    private Integer skippedCount = 0;

    @Column(name = "retest_count", nullable = false)
    private Integer retestCount = 0;

    @Column(name = "untested_count", nullable = false)
    private Integer untestedCount = 0;

    @Column(name = "new_bug_critical", nullable = false)
    private Integer newBugCritical = 0;

    @Column(name = "new_bug_major", nullable = false)
    private Integer newBugMajor = 0;

    @Column(name = "new_bug_minor", nullable = false)
    private Integer newBugMinor = 0;

    @Column(name = "new_bug_trivial", nullable = false)
    private Integer newBugTrivial = 0;

    @Column(name = "closed_bug_count", nullable = false)
    private Integer closedBugCount = 0;

    @Column(name = "open_bug_count", nullable = false)
    private Integer openBugCount = 0;

    @Column(name = "aging_bug_count", nullable = false)
    private Integer agingBugCount = 0;

    @Column(name = "pass_rate", nullable = false)
    private BigDecimal passRate = BigDecimal.ZERO;

    @Column(name = "progress_rate", nullable = false)
    private BigDecimal progressRate = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
