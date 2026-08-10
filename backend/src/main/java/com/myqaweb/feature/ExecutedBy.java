package com.myqaweb.feature;

/**
 * TestResult의 실행 주체.
 * 기존 데이터는 모두 HUMAN(마이그레이션 default)으로 호환된다.
 */
public enum ExecutedBy {
    HUMAN,
    AGENT,
    CI
}
