package com.myqaweb.senior;

import java.util.List;

/**
 * Service interface for chat session management.
 */
public interface ChatSessionService {

    /**
     * Returns all sessions ordered by most recently updated.
     */
    List<ChatSessionDto.SessionResponse> findAllSessions();

    /**
     * Returns session detail with all messages.
     */
    ChatSessionDto.SessionDetailResponse findSessionById(Long id);

    /**
     * Creates a new empty session.
     */
    ChatSessionDto.SessionResponse createSession();

    /**
     * Updates a session's title.
     */
    ChatSessionDto.SessionResponse updateSessionTitle(Long id, String title);

    /**
     * Deletes a session and all its messages.
     */
    void deleteSession(Long id);

    /**
     * Saves a user message and assistant response to the given session.
     * If sessionId is null, creates a new session with the user message as title.
     *
     * @return the session ID (existing or newly created)
     */
    Long saveMessages(Long sessionId, String userMessage, String assistantResponse);
}
