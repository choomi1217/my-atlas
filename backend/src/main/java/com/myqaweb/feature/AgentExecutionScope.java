package com.myqaweb.feature;

/**
 * 에이전트 실행 Job의 대상 범위.
 * <ul>
 *   <li>{@code SINGLE} — TC 단건 시험 실행 (dry run, TestResult 미기록)</li>
 *   <li>{@code PHASE_ALL} — Phase의 전체 TC 실행</li>
 *   <li>{@code PHASE_UNTESTED} — Phase의 UNTESTED TC만 실행</li>
 *   <li>{@code PHASE_PREV_FAIL} — Phase의 이전 FAIL TC만 실행</li>
 *   <li>{@code PHASE_SELECTED} — Phase의 지정 TC만 실행, 결과는 Phase에 반영</li>
 * </ul>
 */
public enum AgentExecutionScope {
    SINGLE,
    PHASE_ALL,
    PHASE_UNTESTED,
    PHASE_PREV_FAIL,
    PHASE_SELECTED
}
