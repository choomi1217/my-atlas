package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for ticket entities.
 */
@Repository
public interface TicketRepository extends JpaRepository<TicketEntity, Long> {
    List<TicketEntity> findAllByTestResultIdOrderByCreatedAtDesc(Long testResultId);

    int countByTestResultId(Long testResultId);

    List<TicketEntity> findAllByTestResultIdIn(List<Long> testResultIds);

    @Query("""
        SELECT COUNT(t) FROM TicketEntity t
        WHERE t.testResult.version.id = :versionId
          AND t.priority = :priority
          AND t.closedAt IS NULL
        """)
    int countOpenByVersionIdAndPriority(@Param("versionId") Long versionId,
                                        @Param("priority") TicketPriority priority);

    @Query("""
        SELECT COUNT(t) FROM TicketEntity t
        WHERE t.testResult.version.id = :versionId
          AND t.closedAt IS NULL
          AND t.createdAt < :threshold
        """)
    int countAgingByVersionId(@Param("versionId") Long versionId,
                               @Param("threshold") LocalDateTime threshold);

    @Query("""
        SELECT t FROM TicketEntity t
        WHERE t.testResult.version.id = :versionId
          AND t.closedAt IS NULL
          AND t.createdAt < :threshold
        """)
    List<TicketEntity> findAgingByVersionId(@Param("versionId") Long versionId,
                                             @Param("threshold") LocalDateTime threshold);
}
