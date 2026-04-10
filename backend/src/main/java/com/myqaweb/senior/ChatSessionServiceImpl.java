package com.myqaweb.senior;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ChatSessionServiceImpl implements ChatSessionService {

    private static final Logger log = LoggerFactory.getLogger(ChatSessionServiceImpl.class);
    private static final int TITLE_MAX_LENGTH = 50;

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ChatSessionDto.SessionResponse> findAllSessions() {
        return chatSessionRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ChatSessionDto.SessionDetailResponse findSessionById(Long id) {
        ChatSessionEntity session = chatSessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + id));

        List<ChatSessionDto.MessageResponse> messages = chatMessageRepository
                .findBySessionIdOrderByCreatedAtAsc(id)
                .stream()
                .map(this::toMessageResponse)
                .toList();

        return new ChatSessionDto.SessionDetailResponse(
                session.getId(),
                session.getTitle(),
                messages,
                session.getCreatedAt(),
                session.getUpdatedAt()
        );
    }

    @Override
    public ChatSessionDto.SessionResponse createSession() {
        ChatSessionEntity session = new ChatSessionEntity();
        session = chatSessionRepository.save(session);
        return toSessionResponse(session);
    }

    @Override
    public ChatSessionDto.SessionResponse updateSessionTitle(Long id, String title) {
        ChatSessionEntity session = chatSessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + id));
        session.setTitle(title);
        session = chatSessionRepository.save(session);
        return toSessionResponse(session);
    }

    @Override
    public void deleteSession(Long id) {
        if (!chatSessionRepository.existsById(id)) {
            throw new IllegalArgumentException("Session not found: " + id);
        }
        chatSessionRepository.deleteById(id);
    }

    @Override
    public Long saveMessages(Long sessionId, String userMessage, String assistantResponse) {
        ChatSessionEntity session;

        if (sessionId != null) {
            session = chatSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
        } else {
            // Create new session with user message as title
            session = new ChatSessionEntity();
            String title = userMessage.length() > TITLE_MAX_LENGTH
                    ? userMessage.substring(0, TITLE_MAX_LENGTH) + "..."
                    : userMessage;
            session.setTitle(title);
            session = chatSessionRepository.save(session);
        }

        // Save user message
        ChatMessageEntity userMsg = new ChatMessageEntity();
        userMsg.setSession(session);
        userMsg.setRole("user");
        userMsg.setContent(userMessage);
        chatMessageRepository.save(userMsg);

        // Save assistant message
        ChatMessageEntity assistantMsg = new ChatMessageEntity();
        assistantMsg.setSession(session);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(assistantResponse);
        chatMessageRepository.save(assistantMsg);

        log.info("Saved chat messages to session id={}", session.getId());
        return session.getId();
    }

    private ChatSessionDto.SessionResponse toSessionResponse(ChatSessionEntity entity) {
        return new ChatSessionDto.SessionResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ChatSessionDto.MessageResponse toMessageResponse(ChatMessageEntity entity) {
        return new ChatSessionDto.MessageResponse(
                entity.getId(),
                entity.getRole(),
                entity.getContent(),
                entity.getCreatedAt()
        );
    }
}
