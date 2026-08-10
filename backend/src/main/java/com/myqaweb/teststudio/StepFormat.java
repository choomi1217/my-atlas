package com.myqaweb.teststudio;

/**
 * Test Studio v2.5 보조 설정 — 생성될 TC의 Step 포맷 힌트.
 *
 * <p>스타일 예시 세트가 있으면 예시가 우선하며, 이 값은 예시가 없을 때의 약한 힌트다.
 */
public enum StepFormat {
    /** 각 Step을 {@code action → expected} 형태로 (현재 기본). */
    ACTION_EXPECTED,
    /** Given / When / Then 구조. */
    GIVEN_WHEN_THEN,
    /** 서술형 시나리오. */
    NARRATIVE
}
