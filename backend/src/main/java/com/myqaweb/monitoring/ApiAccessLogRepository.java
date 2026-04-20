package com.myqaweb.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ApiAccessLogRepository extends JpaRepository<ApiAccessLogEntity, Long> {

    @Query(value = """
            SELECT feature, COUNT(*) AS cnt
            FROM api_access_log
            WHERE created_at BETWEEN :from AND :to
              AND feature IS NOT NULL
            GROUP BY feature
            ORDER BY cnt DESC
            """, nativeQuery = true)
    List<Object[]> countByFeature(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query(value = """
            SELECT method, uri, COUNT(*) AS cnt
            FROM api_access_log
            WHERE created_at BETWEEN :from AND :to
            GROUP BY method, uri
            ORDER BY cnt DESC
            LIMIT 20
            """, nativeQuery = true)
    List<Object[]> topEndpoints(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
