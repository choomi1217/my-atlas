package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 에이전트 실행 Job.
 * TC를 AI 에이전트가 브라우저에서 실행하는 비동기 작업을 추적한다
 * (Test Studio Job 패턴 복제 — PENDING→RUNNING→DONE/FAILED/CANCELLED).
 */
@Entity
@Table(name = "agent_execution_job")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentExecutionJobEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    /** 단건 dry run(SINGLE)이면 null */
    @Column(name = "phase_id")
    private Long phaseId;

    /** SINGLE(dry run) 대상 TC, PHASE_* 범위면 null */
    @Column(name = "target_test_case_id")
    private Long targetTestCaseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AgentExecutionScope scope;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AgentExecutionStatus status = AgentExecutionStatus.PENDING;

    @Column(name = "requested_by", length = 100)
    private String requestedBy;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount = 0;

    @Column(name = "done_count", nullable = false)
    private Integer doneCount = 0;

    @Column(name = "pass_count", nullable = false)
    private Integer passCount = 0;

    @Column(name = "fail_count", nullable = false)
    private Integer failCount = 0;

    @Column(name = "inconclusive_count", nullable = false)
    private Integer inconclusiveCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = AgentExecutionStatus.PENDING;
        }
        if (totalCount == null) {
            totalCount = 0;
        }
        if (doneCount == null) {
            doneCount = 0;
        }
        if (passCount == null) {
            passCount = 0;
        }
        if (failCount == null) {
            failCount = 0;
        }
        if (inconclusiveCount == null) {
            inconclusiveCount = 0;
        }
    }
}
