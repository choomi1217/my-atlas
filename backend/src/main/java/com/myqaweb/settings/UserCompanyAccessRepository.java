package com.myqaweb.settings;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserCompanyAccessRepository extends JpaRepository<UserCompanyAccessEntity, Long> {

    List<UserCompanyAccessEntity> findByUserId(Long userId);

    @Modifying
    @Query("DELETE FROM UserCompanyAccessEntity uca WHERE uca.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @Query("SELECT uca.companyId FROM UserCompanyAccessEntity uca WHERE uca.userId = :userId")
    List<Long> findCompanyIdsByUserId(@Param("userId") Long userId);
}
