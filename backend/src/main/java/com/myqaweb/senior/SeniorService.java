package com.myqaweb.senior;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Optional;

/**
 * Service interface for My Senior feature.
 * Handles AI chat with RAG pipeline and FAQ CRUD operations.
 */
public interface SeniorService {

    /**
     * Processes a chat message through the RAG pipeline and streams the AI response.
     *
     * @param userMessage the user's question
     * @return SseEmitter that streams the AI response
     */
    SseEmitter chat(String userMessage);

    /**
     * Retrieves all FAQ entries.
     *
     * @return list of all FAQ responses
     */
    List<FaqDto.FaqResponse> findAllFaqs();

    /**
     * Retrieves a single FAQ by ID.
     *
     * @param id the FAQ ID
     * @return optional containing the FAQ response if found
     */
    Optional<FaqDto.FaqResponse> findFaqById(Long id);

    /**
     * Creates a new FAQ entry with embedding generation.
     *
     * @param request the FAQ creation request
     * @return the created FAQ response
     */
    FaqDto.FaqResponse createFaq(FaqDto.FaqRequest request);

    /**
     * Updates an existing FAQ entry with embedding regeneration.
     *
     * @param id      the FAQ ID
     * @param request the FAQ update request
     * @return the updated FAQ response
     */
    FaqDto.FaqResponse updateFaq(Long id, FaqDto.FaqRequest request);

    /**
     * Deletes a FAQ entry.
     *
     * @param id the FAQ ID
     */
    void deleteFaq(Long id);
}
