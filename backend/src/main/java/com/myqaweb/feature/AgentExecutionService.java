package com.myqaweb.feature;

import java.util.List;
import java.util.Optional;

/**
 * 에이전트 실행 Job 오케스트레이션.
 *
 * <p>통신 모델은 <b>폴링(polling)</b>이다: 실행 워커(브라우저가 필요한 외부 Node 사이드카)가
 * PENDING Job을 {@code claim}하여 RUNNING으로 전이시키고, TC별 결과를 {@code recordResult}로
 * 보고한 뒤 {@code completeJob}으로 종료한다. Spring 프로세스는 브라우저를 구동하지 않는다.</p>
 */
public interface AgentExecutionService {

    // --- 사용자(프론트) 대상 ---

    /** Job 생성 (PENDING). SINGLE이면 targetTestCaseId, PHASE_*면 phaseId 필요. */
    Long submitJob(AgentExecutionDto.CreateJobRequest request);

    /** 단건 Job 상태 조회 (폴링). */
    AgentExecutionDto.JobResponse getJob(Long jobId);

    /** Product별 Job 목록 (최신순). */
    List<AgentExecutionDto.JobResponse> listByProduct(Long productId);

    /** Phase별 Job 목록 (최신순). */
    List<AgentExecutionDto.JobResponse> listByPhase(Long phaseId);

    /** Job 취소 (PENDING/RUNNING → CANCELLED). */
    AgentExecutionDto.JobResponse cancelJob(Long jobId);

    /** Job의 TC별 실행 결과(증적) 조회. */
    AgentExecutionDto.ResultResponse getResult(Long jobId, Long testCaseId);

    /** Job의 전체 TC 결과(증적) 목록. */
    List<AgentExecutionDto.ResultResponse> listResults(Long jobId);

    /** 워커가 claim 후 받는 실행 컨텍스트 (대상 TC + Product 실행 프로파일). */
    AgentExecutionDto.WorkerContextResponse getExecutionContext(Long jobId);

    // --- 워커 대상 (폴링 통신 경로) ---

    /** 워커가 Job을 점유: PENDING → RUNNING. 이미 RUNNING이면 현재 상태 반환. */
    AgentExecutionDto.JobResponse claimJob(Long jobId);

    /** 워커가 TC 1건 실행 결과 보고 → 결과 저장 + 진행 카운터 갱신. */
    AgentExecutionDto.ResultResponse recordResult(Long jobId, AgentExecutionDto.RecordResultRequest request);

    /** 워커가 Job 종료 보고 (DONE 또는 FAILED). */
    AgentExecutionDto.JobResponse completeJob(Long jobId, AgentExecutionDto.CompleteJobRequest request);

    // --- 라이브 뷰 (registry_v26) ---

    /**
     * 워커가 보낸 최신 화면 프레임 저장. RUNNING Job에만 저장한다.
     *
     * @return 저장했으면 true, Job이 RUNNING이 아니라 저장하지 않았으면 false (없는 Job은 EntityNotFoundException)
     */
    boolean storeFrame(Long jobId, byte[] data, String contentType);

    /** 저장된 최신 프레임. 없으면 empty. */
    Optional<AgentLiveFrameStore.Frame> getFrame(Long jobId);
}
