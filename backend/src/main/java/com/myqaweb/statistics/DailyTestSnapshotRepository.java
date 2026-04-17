package com.myqaweb.statistics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Repository for daily test snapshot entities.
 */
@Repository
public interface DailyTestSnapshotRepository extends JpaRepository<DailyTestSnapshotEntity, Long> {

    Optional<DailyTestSnapshotEntity> findByPhaseIdAndSnapshotDate(Long phaseId, LocalDate date);

    List<DailyTestSnapshotEntity> findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
            Long phaseId, LocalDate from, LocalDate to);

    List<DailyTestSnapshotEntity> findAllByVersionIdAndSnapshotDate(Long versionId, LocalDate date);

    @Modifying
    @Query(value = """
            INSERT INTO daily_test_snapshot (
                version_id, phase_id, snapshot_date,
                total_tc, pass_count, fail_count, blocked_count,
                skipped_count, retest_count, untested_count,
                new_bug_critical, new_bug_major, new_bug_minor, new_bug_trivial,
                closed_bug_count, open_bug_count, aging_bug_count,
                pass_rate, progress_rate, created_at
            ) VALUES (
                :versionId, :phaseId, :date,
                :totalTc, :pass, :fail, :blocked,
                :skipped, :retest, :untested,
                :newCritical, :newMajor, :newMinor, :newTrivial,
                :closed, :open, :aging,
                :passRate, :progressRate, NOW()
            )
            ON CONFLICT (phase_id, snapshot_date)
            DO UPDATE SET
                total_tc = EXCLUDED.total_tc,
                pass_count = EXCLUDED.pass_count,
                fail_count = EXCLUDED.fail_count,
                blocked_count = EXCLUDED.blocked_count,
                skipped_count = EXCLUDED.skipped_count,
                retest_count = EXCLUDED.retest_count,
                untested_count = EXCLUDED.untested_count,
                new_bug_critical = EXCLUDED.new_bug_critical,
                new_bug_major = EXCLUDED.new_bug_major,
                new_bug_minor = EXCLUDED.new_bug_minor,
                new_bug_trivial = EXCLUDED.new_bug_trivial,
                closed_bug_count = EXCLUDED.closed_bug_count,
                open_bug_count = EXCLUDED.open_bug_count,
                aging_bug_count = EXCLUDED.aging_bug_count,
                pass_rate = EXCLUDED.pass_rate,
                progress_rate = EXCLUDED.progress_rate
            """, nativeQuery = true)
    void upsertSnapshot(
            @Param("versionId") Long versionId,
            @Param("phaseId") Long phaseId,
            @Param("date") LocalDate date,
            @Param("totalTc") int totalTc,
            @Param("pass") int pass,
            @Param("fail") int fail,
            @Param("blocked") int blocked,
            @Param("skipped") int skipped,
            @Param("retest") int retest,
            @Param("untested") int untested,
            @Param("newCritical") int newCritical,
            @Param("newMajor") int newMajor,
            @Param("newMinor") int newMinor,
            @Param("newTrivial") int newTrivial,
            @Param("closed") int closed,
            @Param("open") int open,
            @Param("aging") int aging,
            @Param("passRate") BigDecimal passRate,
            @Param("progressRate") BigDecimal progressRate);
}
