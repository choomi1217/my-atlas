package com.myqaweb.teststudio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for 스타일 세트 내 예시 TC.
 */
@Repository
public interface TestStudioStyleExampleRepository extends JpaRepository<TestStudioStyleExampleEntity, Long> {

    /** 세트의 예시 TC를 표시·주입 순서대로. */
    List<TestStudioStyleExampleEntity> findAllByProfileIdOrderBySortOrderAsc(Long profileId);

    /** 세트당 예시 개수 (상한 검증용). */
    long countByProfileId(Long profileId);
}
