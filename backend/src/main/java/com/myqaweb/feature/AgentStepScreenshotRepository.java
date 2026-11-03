package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface AgentStepScreenshotRepository extends JpaRepository<AgentStepScreenshotEntity, Long> {

    Optional<AgentStepScreenshotEntity> findByJobIdAndTestCaseIdAndStepOrder(
            Long jobId, Long testCaseId, Integer stepOrder);

    @Modifying
    @Query("DELETE FROM AgentStepScreenshotEntity s WHERE s.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
