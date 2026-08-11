package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * CI(JUnit XML) 결과 수신 (registry_v20 Phase 3 / Phase A).
 * {@code /api/admin/**} 이므로 SecurityConfig에 의해 ADMIN 권한 필요.
 * CI는 admin 로그인 → JWT로 호출한다.
 */
@RestController
@RequestMapping("/api/admin/test-results")
@RequiredArgsConstructor
public class TestResultImportController {

    private final TestResultImportService importService;

    /**
     * JUnit XML을 Phase의 TC(제목 일치)에 기록.
     * 예: POST /api/admin/test-results/import?versionPhaseId=42  (body: JUnit XML)
     */
    @PostMapping(value = "/import", consumes = {MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE, MediaType.TEXT_PLAIN_VALUE})
    public ResponseEntity<ApiResponse<TestResultImportDto.ImportResponse>> importResults(
            @RequestParam("versionPhaseId") Long versionPhaseId,
            @RequestBody String junitXml) {
        TestResultImportDto.ImportResponse result = importService.importJUnitXml(versionPhaseId, junitXml);
        return ResponseEntity.ok(ApiResponse.ok("CI results imported", result));
    }
}
