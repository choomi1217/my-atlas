package com.myqaweb.senior;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, Long> {

    List<ChatSessionEntity> findAllByOrderByUpdatedAtDesc();
}
