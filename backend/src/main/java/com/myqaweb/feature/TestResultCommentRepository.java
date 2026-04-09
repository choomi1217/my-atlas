package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestResultCommentRepository extends JpaRepository<TestResultCommentEntity, Long> {
    List<TestResultCommentEntity> findAllByTestResultIdOrderByCreatedAtAsc(Long testResultId);

    List<TestResultCommentEntity> findAllByTestResultIdAndParentIsNullOrderByCreatedAtAsc(Long testResultId);
}
