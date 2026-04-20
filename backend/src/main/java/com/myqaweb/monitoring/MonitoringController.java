package com.myqaweb.monitoring;

import com.myqaweb.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin/monitoring")
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;

    @GetMapping("/ai-summary")
    public ResponseEntity<ApiResponse<MonitoringDto.AiUsageSummary>> getAiSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);
        return ResponseEntity.ok(ApiResponse.ok(monitoringService.getAiUsageSummary(fromDt, toDt)));
    }

    @GetMapping("/ai-daily-trend")
    public ResponseEntity<ApiResponse<List<MonitoringDto.DailyTrend>>> getDailyTrend(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);
        return ResponseEntity.ok(ApiResponse.ok(monitoringService.getDailyTrend(fromDt, toDt)));
    }

    @GetMapping("/ai-by-feature")
    public ResponseEntity<ApiResponse<List<MonitoringDto.FeatureUsage>>> getByFeature(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);
        MonitoringDto.AiUsageSummary summary = monitoringService.getAiUsageSummary(fromDt, toDt);
        return ResponseEntity.ok(ApiResponse.ok(summary.byFeature()));
    }

    @GetMapping("/api-summary")
    public ResponseEntity<ApiResponse<MonitoringDto.ApiAccessSummary>> getApiSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);
        return ResponseEntity.ok(ApiResponse.ok(monitoringService.getApiAccessSummary(fromDt, toDt)));
    }
}
