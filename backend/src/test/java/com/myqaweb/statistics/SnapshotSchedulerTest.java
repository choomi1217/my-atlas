package com.myqaweb.statistics;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.mockito.Mockito.verify;

/**
 * Unit tests for SnapshotScheduler.
 */
@ExtendWith(MockitoExtension.class)
class SnapshotSchedulerTest {

    @Mock
    private SnapshotService snapshotService;

    @InjectMocks
    private SnapshotScheduler snapshotScheduler;

    @Test
    void testDailySnapshot_SnapshotsYesterday() {
        snapshotScheduler.dailySnapshot();

        verify(snapshotService).createSnapshotsForDate(LocalDate.now().minusDays(1));
    }
}
