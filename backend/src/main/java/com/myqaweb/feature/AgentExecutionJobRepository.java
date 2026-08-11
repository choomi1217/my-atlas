package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgentExecutionJobRepository extends JpaRepository<AgentExecutionJobEntity, Long> {

    List<AgentExecutionJobEntity> findAllByProductIdOrderByCreatedAtDesc(Long productId);

    List<AgentExecutionJobEntity> findAllByPhaseIdOrderByCreatedAtDesc(Long phaseId);
}
