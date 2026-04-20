package com.myqaweb.monitoring;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "api_access_log")
@Data
@NoArgsConstructor
public class ApiAccessLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 500)
    private String uri;

    @Column(length = 50)
    private String feature;

    @Column(nullable = false)
    private Integer statusCode;

    @Column(nullable = false)
    private Long durationMs;

    @Column(length = 50)
    private String username;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
