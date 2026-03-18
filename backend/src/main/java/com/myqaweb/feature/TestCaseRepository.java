package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCaseEntity, Long> {
    List<TestCaseEntity> findAllByFeatureId(Long featureId);

    List<TestCaseEntity> findAllByFeatureIdAndStatus(Long featureId, TestStatus status);
}
