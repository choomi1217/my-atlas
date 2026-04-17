package com.myqaweb.statistics;

import com.myqaweb.common.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * REST controller for statistics and reporting endpoints.
 */
@RestController
public class StatisticsController {

    private final StatisticsService statisticsService;
    private final SnapshotService snapshotService;

    public StatisticsController(StatisticsService statisticsService,
                                 SnapshotService snapshotService) {
        this.statisticsService = statisticsService;
        this.snapshotService = snapshotService;
    }

    /**
     * Gets the daily report for a specific phase on a given date.
     */
    @GetMapping("/api/phases/{id}/reports/daily")
    public ResponseEntity<ApiResponse<StatisticsDto.DailyReport>> getDailyReport(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(statisticsService.getDailyReport(id, date)));
    }

    /**
     * Gets trend data for a phase over a date range.
     */
    @GetMapping("/api/phases/{id}/reports/trend")
    public ResponseEntity<ApiResponse<StatisticsDto.TrendData>> getTrend(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(statisticsService.getTrend(id, from, to)));
    }

    /**
     * Evaluates release readiness for a version.
     */
    @GetMapping("/api/versions/{id}/release-readiness")
    public ResponseEntity<ApiResponse<StatisticsDto.ReleaseReadiness>> getReleaseReadiness(
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(statisticsService.getReleaseReadiness(id)));
    }

    /**
     * Gets the full dashboard data for a version.
     */
    @GetMapping("/api/versions/{id}/dashboard")
    public ResponseEntity<ApiResponse<StatisticsDto.Dashboard>> getDashboard(
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(statisticsService.getDashboard(id)));
    }

    /**
     * Manually triggers snapshot creation for a specific date.
     */
    @PostMapping("/api/admin/snapshots/run")
    public ResponseEntity<ApiResponse<Void>> runSnapshot(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        snapshotService.createSnapshotsForDate(date);
        return ResponseEntity.ok(ApiResponse.ok("Snapshot created for " + date, null));
    }
}
