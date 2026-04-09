package com.myqaweb.senior;

import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Service interface for My Senior feature.
 * Handles AI chat with RAG pipeline and curated FAQ view.
 */
public interface SeniorService {

    /**
     * Processes a chat request through the RAG pipeline and streams the AI response.
     *
     * @param request the chat request containing message and optional FAQ context
     * @return SseEmitter that streams the AI response
     */
    SseEmitter chat(ChatDto.ChatRequest request);

    /**
     * Returns curated FAQ list from Knowledge Base.
     * Combines pinned entries (up to 15) and top hit entries (up to 5).
     *
     * @return curated list of KB responses (max 20)
     */
    List<KnowledgeBaseDto.KbResponse> getCuratedFaqs();
}
