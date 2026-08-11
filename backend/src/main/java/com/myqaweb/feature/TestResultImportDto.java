package com.myqaweb.feature;

import java.util.List;

/**
 * CI(JUnit XML) 결과 수신 DTO (registry_v20 Phase 3 / Phase A).
 */
public final class TestResultImportDto {

    private TestResultImportDto() {
    }

    /** 파싱된 JUnit testcase 1건 */
    public record ParsedCase(String name, RunResultStatus status) {
    }

    /** import 결과 요약 */
    public record ImportResponse(
            int totalCases,
            int matched,
            int recorded,
            List<String> unmatched
    ) {
    }
}
