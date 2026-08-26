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
            /** 실행 대상 종류. 워커가 claim 전에 자기 담당인지 판단한다 (v24 Step 8). */
            ExecTargetKind execTargetKind,
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
            return from(e, null);
        }

        /** @param execTargetKind 제품이 선언한 실행 대상 종류 (없으면 null) */
        public static JobResponse from(AgentExecutionJobEntity e, ExecTargetKind execTargetKind) {
            return new JobResponse(
                    e.getId(), e.getProductId(), e.getPhaseId(), e.getTargetTestCaseId(),
                    e.getScope(), e.getStatus(), execTargetKind, e.getRequestedBy(),
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
            ExecTargetKind execTargetKind,
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
            List<String> expectedResults,
            List<String> segmentPath
    ) {
        /**
         * @param segmentNames TC가 속한 Segment 경로를 루트→말단 순의 **이름**으로.
         *                     ID 배열은 에이전트에게 무의미하므로 반드시 이름으로 해석해 넘긴다.
         *                     이 경로가 곧 TC의 전제조건이다 (registry_v24 §4).
         */
        public static TestCaseContext from(TestCaseEntity e, List<String> segmentNames) {
            return new TestCaseContext(
                    e.getId(), e.getTitle(), e.getPreconditions(),
                    e.getSteps(), e.getExpectedResults(),
                    segmentNames == null ? List.of() : segmentNames);
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
