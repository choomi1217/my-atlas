package com.myqaweb.monitoring;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link AccessLogRetentionScheduler} — retention flag, positive-days
 * guard, and the cutoff passed to the repository.
 */
@ExtendWith(MockitoExtension.class)
class AccessLogRetentionSchedulerTest {

    @Mock
    private ApiAccessLogRepository repository;

    @Test
    @DisplayName("retention 활성 + 90일 → cutoff 를 now-90일 근처로 계산해 삭제 호출")
    void purgeOldAccessLogs_enabled_deletesWithCutoff() {
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, true, 90);
        LocalDateTime before = LocalDateTime.now().minusDays(90);

        scheduler.purgeOldAccessLogs();

        LocalDateTime after = LocalDateTime.now().minusDays(90);
        ArgumentCaptor<LocalDateTime> captor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteOlderThan(captor.capture());
        LocalDateTime cutoff = captor.getValue();
        // 실행 시간 오차를 감안해 범위로만 검증한다 (정확한 등호 비교는 flaky).
        assertTrue(cutoff.isAfter(before.minusMinutes(1)),
                "cutoff 는 now-90일보다 지나치게 과거일 수 없다: " + cutoff);
        assertTrue(cutoff.isBefore(after.plusMinutes(1)),
                "cutoff 는 now-90일보다 지나치게 미래일 수 없다: " + cutoff);
    }

    @Test
    @DisplayName("retention 비활성 → 삭제 호출 없음")
    void purgeOldAccessLogs_disabled_doesNothing() {
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, false, 90);

        scheduler.purgeOldAccessLogs();

        verify(repository, never()).deleteOlderThan(any());
    }

    @Test
    @DisplayName("retentionDays 가 0 → 전체 삭제 방지 가드로 삭제 호출 없음")
    void purgeOldAccessLogs_zeroDays_doesNothing() {
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, true, 0);

        scheduler.purgeOldAccessLogs();

        verify(repository, never()).deleteOlderThan(any());
    }

    @Test
    @DisplayName("retentionDays 가 음수 → 삭제 호출 없음")
    void purgeOldAccessLogs_negativeDays_doesNothing() {
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, true, -1);

        scheduler.purgeOldAccessLogs();

        verify(repository, never()).deleteOlderThan(any());
    }

    @Test
    @DisplayName("삭제 건수를 반환해도 예외 없이 정상 완료")
    void purgeOldAccessLogs_returnsDeletedCount_completesNormally() {
        when(repository.deleteOlderThan(any())).thenReturn(1234);
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, true, 30);

        scheduler.purgeOldAccessLogs();

        verify(repository).deleteOlderThan(any());
    }
}
