package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseImageRepository extends JpaRepository<TestCaseImageEntity, Long> {
    List<TestCaseImageEntity> findAllByTestCaseIdOrderByOrderIndex(Long testCaseId);

    int countByTestCaseId(Long testCaseId);

    void deleteAllByTestCaseId(Long testCaseId);
}
