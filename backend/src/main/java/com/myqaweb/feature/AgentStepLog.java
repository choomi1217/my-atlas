package com.myqaweb.feature;

/**
 * 에이전트 실행 중 TC step 하나에 대한 증적 로그 (agent_execution_result.step_logs 항목).
 *
 * @param order        TC step 순번
 * @param actionTaken  에이전트가 실제로 수행한 액션
 * @param observed     수행 후 화면에서 관측한 상태
 * @param judgment     step 판정 결과/사유 (PASS/FAIL/모호 등)
 * @param screenshotKey S3 스크린샷 키 (없으면 null)
 */
public record AgentStepLog(
        Integer order,
        String actionTaken,
        String observed,
        String judgment,
        String screenshotKey
) {
}
