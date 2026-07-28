package com.myqaweb.teststudio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for Test Studio Company 보조 설정 (1:1).
 */
@Repository
public interface TestStudioConfigRepository extends JpaRepository<TestStudioConfigEntity, Long> {

    /** Company의 설정 (없으면 기본값으로 fallback). */
    Optional<TestStudioConfigEntity> findByCompanyId(Long companyId);
}
