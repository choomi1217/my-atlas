package com.myqaweb.teststudio;

/**
 * Test Studio v2.5 보조 설정 — 생성될 TC의 상세 수준 힌트.
 *
 * <p>스타일 예시 세트가 있으면 예시가 우선하며, 이 값은 예시가 없을 때의 약한 힌트다.
 */
public enum DetailLevel {
    /** 핵심 Step만 간결히. */
    CONCISE,
    /** 표준 수준. */
    STANDARD,
    /** 세부 조건·엣지까지 촘촘히. */
    DETAILED
}
