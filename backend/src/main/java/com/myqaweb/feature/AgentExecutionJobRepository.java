package com.myqaweb.feature;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AgentExecutionJobRepository extends JpaRepository<AgentExecutionJobEntity, Long> {

    List<AgentExecutionJobEntity> findAllByProductIdOrderByCreatedAtDesc(Long productId);

    List<AgentExecutionJobEntity> findAllByPhaseIdOrderByCreatedAtDesc(Long phaseId);

    Page<AgentExecutionJobEntity> findAllByStatusIn(Collection<AgentExecutionStatus> statuses, Pageable pageable);

    List<AgentExecutionJobEntity> findAllByPhaseIdAndStatusIn(Long phaseId, Collection<AgentExecutionStatus> statuses);
}
