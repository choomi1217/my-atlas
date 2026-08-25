package com.myqaweb.feature;

/**
 * 에이전트 실행 대상 종류 (registry_v24 Step 8).
 * <p>
 * 제품 분류인 {@link Platform}과는 별개다 — 한 제품이 웹과 앱을 동시에 가질 수 있으므로
 * "무엇을 자동화 실행 대상으로 삼을지"는 따로 선언한다.
 * 워커는 자기가 구동할 수 있는 종류의 Job만 집는다.
 */
public enum ExecTargetKind {
    WEB,
    ANDROID,
    IOS
}
