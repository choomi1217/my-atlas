package com.myqaweb.feature;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 에이전트 실행 Job API의 요청/응답 DTO 모음.
 */
public final class AgentExecutionDto {

    private AgentExecutionDto() {
    }

    /**
     * Job 생성 요청.
     * SINGLE이면 targetTestCaseId 필수, PHASE_* 이면 phaseId 필수.
     */
    public record CreateJobRequest(
            @NotNull AgentExecutionScope scope,
            @NotNull Long productId,
            Long phaseId,
            Long targetTestCaseId,
            String requestedBy
    ) {
    }

    /**
     * Job 상태 응답 (프론트 폴링 + 워커 claim 공용).
     */
    public record JobResponse(
            Long id,
            Long productId,
            Long phaseId,
            Long targetTestCaseId,
            AgentExecutionScope scope,
            AgentExecutionStatus status,
            String requestedBy,
            Integer totalCount,
            Integer doneCount,
            Integer passCount,
            Integer failCount,
            Integer inconclusiveCount,
            String errorMessage,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {
        public static JobResponse from(AgentExecutionJobEntity e) {
            return new JobResponse(
                    e.getId(), e.getProductId(), e.getPhaseId(), e.getTargetTestCaseId(),
                    e.getScope(), e.getStatus(), e.getRequestedBy(),
                    e.getTotalCount(), e.getDoneCount(), e.getPassCount(),
                    e.getFailCount(), e.getInconclusiveCount(),
                    e.getErrorMessage(), e.getCreatedAt(), e.getCompletedAt());
        }
    }

    /**
     * 워커가 TC 1건 실행 결과를 보고 (폴링 모델).
     */
    public record RecordResultRequest(
            @NotNull Long testCaseId,
            @NotNull AgentVerdict verdict,
            List<AgentStepLog> stepLogs,
            String aiFailureAnalysis,
            Long durationMs,
            Integer tokenCost
    ) {
    }

    /**
     * 워커가 Job 종료를 보고. status는 DONE 또는 FAILED.
     */
    public record CompleteJobRequest(
            @NotNull AgentExecutionStatus status,
            String errorMessage
    ) {
    }

    /**
     * 워커가 claim 후 받는 실행 컨텍스트.
     * 대상 TC 목록 + Product 실행 프로파일(baseUrl, seed 절차).
     */
    public record WorkerContextResponse(
            Long jobId,
            AgentExecutionScope scope,
            String baseUrl,
            String seedNote,
            List<TestCaseContext> testCases
    ) {
    }

    /**
     * 워커가 실행할 TC 1건의 내용.
     */
    public record TestCaseContext(
            Long id,
            String title,
            String preconditions,
            List<TestStep> steps,
            List<String> expectedResults
    ) {
        public static TestCaseContext from(TestCaseEntity e) {
            return new TestCaseContext(
                    e.getId(), e.getTitle(), e.getPreconditions(),
                    e.getSteps(), e.getExpectedResults());
        }
    }

    /**
     * 실행 결과 상세 (step별 증적 조회).
     */
    public record ResultResponse(
            Long id,
            Long jobId,
            Long testCaseId,
            AgentVerdict verdict,
            List<AgentStepLog> stepLogs,
            String aiFailureAnalysis,
            Long durationMs,
            Integer tokenCost,
            LocalDateTime createdAt
    ) {
        public static ResultResponse from(AgentExecutionResultEntity e) {
            return new ResultResponse(
                    e.getId(), e.getJobId(), e.getTestCaseId(), e.getVerdict(),
                    e.getStepLogs(), e.getAiFailureAnalysis(),
                    e.getDurationMs(), e.getTokenCost(), e.getCreatedAt());
        }
    }
}
