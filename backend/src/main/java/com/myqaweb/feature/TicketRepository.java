package com.myqaweb.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for ticket entities.
 */
@Repository
public interface TicketRepository extends JpaRepository<TicketEntity, Long> {
    List<TicketEntity> findAllByTestResultIdOrderByCreatedAtDesc(Long testResultId);

    int countByTestResultId(Long testResultId);
}
