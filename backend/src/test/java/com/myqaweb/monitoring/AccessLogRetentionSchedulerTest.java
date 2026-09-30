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

/**
 * Tests for {@link AccessLogRetentionScheduler} — the cutoff passed to the
 * repository, and the positive-days guard that doubles as the off switch.
 */
@ExtendWith(MockitoExtension.class)
class AccessLogRetentionSchedulerTest {

    @Mock
    private ApiAccessLogRepository repository;

    @Test
    @DisplayName("retention 90일 → cutoff 를 now-90일 근처로 계산해 삭제 호출")
    void purgeOldAccessLogs_positiveDays_deletesWithCutoff() {
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, 90);
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
    @DisplayName("retentionDays 가 0 → 전체 삭제 방지 가드로 삭제 호출 없음 (off 스위치 겸용)")
    void purgeOldAccessLogs_zeroDays_doesNothing() {
        AccessLogRetentionScheduler scheduler = new AccessLogRetentionScheduler(repository, 0);

        scheduler.purgeOldAccessLogs();

        verify(repository, never()).deleteOlderThan(any());
    }
}
