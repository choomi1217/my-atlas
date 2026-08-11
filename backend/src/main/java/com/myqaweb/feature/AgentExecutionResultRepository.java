package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentExecutionResultRepository extends JpaRepository<AgentExecutionResultEntity, Long> {

    List<AgentExecutionResultEntity> findAllByJobId(Long jobId);

    Optional<AgentExecutionResultEntity> findByJobIdAndTestCaseId(Long jobId, Long testCaseId);
}
