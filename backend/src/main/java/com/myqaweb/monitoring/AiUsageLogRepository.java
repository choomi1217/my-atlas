package com.myqaweb.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AiUsageLogRepository extends JpaRepository<AiUsageLogEntity, Long> {

    List<AiUsageLogEntity> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    @Query(value = """
            SELECT feature, provider,
                   COUNT(*) AS calls,
                   COALESCE(SUM(input_tokens), 0) AS input_tokens,
                   COALESCE(SUM(output_tokens), 0) AS output_tokens,
                   COALESCE(SUM(total_tokens), 0) AS total_tokens,
                   COALESCE(SUM(estimated_cost), 0) AS total_cost,
                   COALESCE(AVG(duration_ms), 0) AS avg_duration_ms,
                   SUM(CASE WHEN success THEN 1 ELSE 0 END) AS success_count,
                   SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failure_count
            FROM ai_usage_log
            WHERE created_at BETWEEN :from AND :to
            GROUP BY feature, provider
            ORDER BY total_cost DESC
            """, nativeQuery = true)
    List<Object[]> aggregateByFeatureAndProvider(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query(value = """
            SELECT DATE(created_at) AS day,
                   COUNT(*) AS calls,
                   COALESCE(SUM(total_tokens), 0) AS total_tokens,
                   COALESCE(SUM(estimated_cost), 0) AS total_cost
            FROM ai_usage_log
            WHERE created_at BETWEEN :from AND :to
            GROUP BY DATE(created_at)
            ORDER BY day
            """, nativeQuery = true)
    List<Object[]> dailyTrend(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
