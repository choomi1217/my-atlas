package com.myqaweb.convention;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for Convention CRUD operations.
 */
public interface ConventionService {

    List<ConventionDto.ConventionResponse> findAll();

    Optional<ConventionDto.ConventionResponse> findById(Long id);

    ConventionDto.ConventionResponse create(ConventionDto.ConventionRequest request);

    ConventionDto.ConventionResponse update(Long id, ConventionDto.ConventionRequest request);

    void delete(Long id);
}
