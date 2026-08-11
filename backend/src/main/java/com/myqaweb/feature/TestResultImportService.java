package com.myqaweb.feature;

/**
 * CI(JUnit XML) 결과를 TestResult에 기록 (executed_by=CI).
 * 에이전트 실행과 동일한 소비 경로(TestResult 생태계)로 합류한다.
 */
public interface TestResultImportService {

    /**
     * JUnit XML을 파싱해 Phase의 TC(제목 일치)에 결과를 upsert 한다.
     *
     * @param versionPhaseId 대상 Phase
     * @param junitXml       JUnit testsuites/testcase XML
     * @return 매칭·기록 요약
     */
    TestResultImportDto.ImportResponse importJUnitXml(Long versionPhaseId, String junitXml);
}
