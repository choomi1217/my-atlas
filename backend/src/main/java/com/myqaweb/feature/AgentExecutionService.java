package com.myqaweb.feature;

import org.springframework.data.domain.Sort;

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

    /**
     * Job 생성 (PENDING). SINGLE이면 targetTestCaseId, PHASE_*면 phaseId 필요.
     * 실행 대상 TC ID는 이 시점에 고정해 저장한다. PHASE_SELECTED는 testCaseIds가 해당 Phase 소속이어야 한다.
     *
     * @throws com.myqaweb.common.ConflictException 같은 Phase의 대기·실행 중 Job과 TC가 겹칠 때
     */
    Long submitJob(AgentExecutionDto.CreateJobRequest request);

    /**
     * 전체 Job 목록 (페이지). 제품·Phase·TC 이름은 일괄 조회로 채운다.
     *
     * @param statuses 조회할 상태. null/empty면 전체
     * @param size 최대 100으로 제한
     * @param direction createdAt 정렬 방향
     */
    AgentExecutionDto.JobPageResponse listQueue(
            List<AgentExecutionStatus> statuses, int page, int size, Sort.Direction direction);

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

    /**
     * 워커가 Job을 점유: PENDING → RUNNING (startedAt, workerId 기록). 이미 RUNNING이면 현재 상태 반환.
     *
     * @param workerId 점유한 워커 ID (구버전 워커는 null)
     */
    AgentExecutionDto.JobResponse claimJob(Long jobId, String workerId);

    /** 워커 heartbeat 기록 (메모리). */
    void heartbeat(AgentExecutionDto.WorkerHeartbeatRequest request);

    /** 연결된 워커 목록 (마지막 heartbeat 15초 이내). */
    List<AgentExecutionDto.WorkerStatus> listWorkers();

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

    // --- 라이브 진행 상황 (registry_v27) ---

    /**
     * 워커가 보낸 최신 TC/step 진행 상황 저장. RUNNING Job에만 저장한다.
     *
     * @return 저장했으면 true, Job이 RUNNING이 아니라 저장하지 않았으면 false (없는 Job은 EntityNotFoundException)
     */
    boolean storeProgress(Long jobId, AgentExecutionDto.LiveProgress progress);

    /** 저장된 최신 진행 상황. 없으면 empty. */
    Optional<AgentExecutionDto.LiveProgress> getProgress(Long jobId);

    // --- Step 스크린샷 (registry_v31) ---

    /**
     * Step 스크린샷 저장 (Job 상태 무관). (jobId, testCaseId, stepOrder)가 같으면 덮어쓴다.
     * 긴 변 1280px JPEG로 변환해 저장하며, 변환에 실패하면 원본을 그대로 저장한다.
     * 없는 Job은 EntityNotFoundException.
     */
    void storeScreenshot(Long jobId, Long testCaseId, Integer stepOrder, byte[] data, String contentType);

    /** 저장된 Step 스크린샷. 없으면 empty. */
    Optional<AgentStepScreenshotEntity> getScreenshot(Long jobId, Long testCaseId, Integer stepOrder);
}
