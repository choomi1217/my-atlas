package com.myqaweb.knowledgebase;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KbCategoryRepository extends JpaRepository<KbCategoryEntity, Long> {

    Optional<KbCategoryEntity> findByName(String name);

    List<KbCategoryEntity> findByNameContainingIgnoreCaseOrderByNameAsc(String query);

    boolean existsByName(String name);
}
