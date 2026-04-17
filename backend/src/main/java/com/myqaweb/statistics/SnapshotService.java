package com.myqaweb.statistics;

import java.time.LocalDate;

/**
 * Service for creating daily test snapshots.
 */
public interface SnapshotService {

    /**
     * Creates a snapshot for a specific phase on a given date.
     */
    void createSnapshot(Long phaseId, LocalDate date);

    /**
     * Creates snapshots for all active phases on a given date.
     */
    void createSnapshotsForDate(LocalDate date);
}
