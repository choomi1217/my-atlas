package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * TestResult entity representing test execution results.
 */
@Entity
@Table(name = "test_result")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestResultEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id", nullable = false)
    private VersionEntity version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_phase_id", nullable = false)
    private VersionPhaseEntity versionPhase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id", nullable = false)
    private TestCaseEntity testCase;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RunResultStatus status = RunResultStatus.UNTESTED;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column
    private LocalDateTime executedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
