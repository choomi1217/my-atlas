package com.myqaweb.knowledgebase;

import java.util.List;
import java.util.Optional;

public interface KnowledgeBaseService {

    List<KnowledgeBaseDto.KbResponse> findAll(String search, String sort);

    Optional<KnowledgeBaseDto.KbResponse> findById(Long id);

    KnowledgeBaseDto.KbResponse create(KnowledgeBaseDto.KbRequest request);

    KnowledgeBaseDto.KbResponse update(Long id, KnowledgeBaseDto.KbRequest request);

    void delete(Long id);

    void pinKbEntry(Long id);

    void unpinKbEntry(Long id);

    List<KnowledgeBaseDto.KbResponse> getCuratedFaqs();
}
