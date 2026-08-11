package com.myqaweb.feature;

/**
 * 에이전트 실행 Job의 생명주기 상태.
 * Test Studio Job 패턴을 복제하되, 취소(CANCELLED)를 추가 지원한다.
 */
public enum AgentExecutionStatus {
    PENDING,
    RUNNING,
    DONE,
    FAILED,
    CANCELLED
}
