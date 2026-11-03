package com.myqaweb.feature;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Tests for {@link AgentArtifactRetentionScheduler} — the cutoff passed to the
 * repository, and the positive-days guard that doubles as the off switch.
 */
@ExtendWith(MockitoExtension.class)
class AgentArtifactRetentionSchedulerTest {

    @Mock
    private AgentStepScreenshotRepository repository;

    @Test
    @DisplayName("retention 30일 → cutoff 를 now-30일 근처로 계산해 삭제 호출")
    void purgeOldArtifacts_positiveDays_deletesWithCutoff() {
        AgentArtifactRetentionScheduler scheduler = new AgentArtifactRetentionScheduler(repository, 30);
        LocalDateTime before = LocalDateTime.now().minusDays(30);

        scheduler.purgeOldArtifacts();

        LocalDateTime after = LocalDateTime.now().minusDays(30);
        ArgumentCaptor<LocalDateTime> captor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteOlderThan(captor.capture());
        LocalDateTime cutoff = captor.getValue();
        assertTrue(cutoff.isAfter(before.minusMinutes(1)),
                "cutoff 는 now-30일보다 지나치게 과거일 수 없다: " + cutoff);
        assertTrue(cutoff.isBefore(after.plusMinutes(1)),
                "cutoff 는 now-30일보다 지나치게 미래일 수 없다: " + cutoff);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    @DisplayName("retentionDays 가 0 이하 → 전체 삭제 방지 가드로 삭제 호출 없음 (off 스위치 겸용)")
    void purgeOldArtifacts_nonPositiveDays_doesNothing(int retentionDays) {
        AgentArtifactRetentionScheduler scheduler = new AgentArtifactRetentionScheduler(repository, retentionDays);

        scheduler.purgeOldArtifacts();

        verify(repository, never()).deleteOlderThan(any());
    }
}
