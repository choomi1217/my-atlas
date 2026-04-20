package com.myqaweb.monitoring;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_usage_log")
@Data
@NoArgsConstructor
public class AiUsageLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String feature;

    @Column(nullable = false, length = 20)
    private String provider;

    @Column(nullable = false, length = 80)
    private String model;

    private Integer inputTokens;

    private Integer outputTokens;

    private Integer totalTokens;

    @Column(precision = 10, scale = 6)
    private BigDecimal estimatedCost;

    @Column(nullable = false)
    private Long durationMs;

    @Column(nullable = false)
    private Boolean success = true;

    @Column(length = 500)
    private String errorMessage;

    @Column(length = 50)
    private String username;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
