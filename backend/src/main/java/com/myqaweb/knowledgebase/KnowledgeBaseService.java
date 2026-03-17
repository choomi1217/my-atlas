package com.myqaweb.knowledgebase;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class KnowledgeBaseService {

    public List<String> findAll() {
        // TODO: return real data from repository
        return List.of("Knowledge Base placeholder");
    }
}
