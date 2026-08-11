package com.myqaweb.feature;

/**
 * 에이전트 TC 실행의 판정 결과.
 * INCONCLUSIVE(판정 불가)는 TestResult 상태로는 RETEST로 매핑되어 사람 확인 대기열이 된다
 * (기존 RunResultStatus Enum 확장을 피하기 위한 결정 — registry_v20 참조).
 */
public enum AgentVerdict {
    PASS,
    FAIL,
    INCONCLUSIVE
}
