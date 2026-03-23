package com.myqaweb.knowledgebase;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for Knowledge Base CRUD operations.
 */
public interface KnowledgeBaseService {

    List<KnowledgeBaseDto.KbResponse> findAll();

    Optional<KnowledgeBaseDto.KbResponse> findById(Long id);

    KnowledgeBaseDto.KbResponse create(KnowledgeBaseDto.KbRequest request);

    KnowledgeBaseDto.KbResponse update(Long id, KnowledgeBaseDto.KbRequest request);

    void delete(Long id);
}
