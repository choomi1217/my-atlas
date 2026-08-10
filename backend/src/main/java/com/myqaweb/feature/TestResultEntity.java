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

    /** 실행 주체 (기존 데이터는 HUMAN) — registry_v20 */
    @Enumerated(EnumType.STRING)
    @Column(name = "executed_by", nullable = false, length = 20)
    private ExecutedBy executedBy = ExecutedBy.HUMAN;

    /** 에이전트 실행 시 증적 역참조 (agent_execution_result.id), 수동 실행이면 null */
    @Column(name = "agent_execution_result_id")
    private Long agentExecutionResultId;

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
