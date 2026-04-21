package com.myqaweb.convention;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WordCategoryRepository extends JpaRepository<WordCategoryEntity, Long> {

    Optional<WordCategoryEntity> findByName(String name);

    List<WordCategoryEntity> findByNameContainingIgnoreCaseOrderByNameAsc(String query);

    boolean existsByName(String name);
}
