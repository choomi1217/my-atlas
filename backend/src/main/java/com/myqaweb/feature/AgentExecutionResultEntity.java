package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 에이전트 실행 결과 (Job 하위, TC별).
 * step별 증적(step_logs)과 AI 실패 분석을 담는다.
 */
@Entity
@Table(name = "agent_execution_result")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentExecutionResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "test_case_id", nullable = false)
    private Long testCaseId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private AgentVerdict verdict;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "step_logs", columnDefinition = "JSONB")
    private List<AgentStepLog> stepLogs;

    /** 제품 결함 / 테스트 결함 / 환경 분류 + 근거 */
    @Column(name = "ai_failure_analysis", columnDefinition = "TEXT")
    private String aiFailureAnalysis;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "token_cost")
    private Integer tokenCost;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
