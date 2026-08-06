package com.myqaweb.teststudio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Test Studio 스타일 세트(프로필).
 */
@Repository
public interface TestStudioStyleProfileRepository extends JpaRepository<TestStudioStyleProfileEntity, Long> {

    /** Company의 모든 스타일 세트, 생성순. */
    List<TestStudioStyleProfileEntity> findAllByCompanyIdOrderByCreatedAtAsc(Long companyId);

    /** Company당 세트 개수 (상한 검증용). */
    long countByCompanyId(Long companyId);
}
