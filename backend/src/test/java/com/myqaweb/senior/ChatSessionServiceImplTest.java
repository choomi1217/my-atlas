package com.myqaweb.senior;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatSessionServiceImplTest {

    @Mock
    private ChatSessionRepository chatSessionRepository;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @InjectMocks
    private ChatSessionServiceImpl chatSessionService;

    private final LocalDateTime now = LocalDateTime.now();

    // --- findAllSessions ---

    @Test
    void findAllSessions_returnsAllSessionsOrderedByUpdatedAt() {
        ChatSessionEntity s1 = createSession(1L, "Session 1");
        ChatSessionEntity s2 = createSession(2L, "Session 2");
        when(chatSessionRepository.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of(s2, s1));

        List<ChatSessionDto.SessionResponse> result = chatSessionService.findAllSessions();

        assertEquals(2, result.size());
        assertEquals("Session 2", result.get(0).title());
        assertEquals("Session 1", result.get(1).title());
    }

    @Test
    void findAllSessions_returnsEmptyList() {
        when(chatSessionRepository.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of());

        List<ChatSessionDto.SessionResponse> result = chatSessionService.findAllSessions();

        assertTrue(result.isEmpty());
    }

    // --- findSessionById ---

    @Test
    void findSessionById_returnsSessionWithMessages() {
        ChatSessionEntity session = createSession(1L, "Test Session");
        when(chatSessionRepository.findById(1L)).thenReturn(Optional.of(session));

        ChatMessageEntity msg1 = createMessage(1L, session, "user", "Hello");
        ChatMessageEntity msg2 = createMessage(2L, session, "assistant", "Hi there!");
        when(chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(1L)).thenReturn(List.of(msg1, msg2));

        ChatSessionDto.SessionDetailResponse result = chatSessionService.findSessionById(1L);

        assertEquals(1L, result.id());
        assertEquals("Test Session", result.title());
        assertEquals(2, result.messages().size());
        assertEquals("user", result.messages().get(0).role());
        assertEquals("assistant", result.messages().get(1).role());
    }

    @Test
    void findSessionById_throwsWhenNotFound() {
        when(chatSessionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> chatSessionService.findSessionById(999L));
    }

    // --- createSession ---

    @Test
    void createSession_createsEmptySession() {
        ChatSessionEntity saved = createSession(1L, null);
        when(chatSessionRepository.save(any())).thenReturn(saved);

        ChatSessionDto.SessionResponse result = chatSessionService.createSession();

        assertNotNull(result);
        assertEquals(1L, result.id());
        verify(chatSessionRepository).save(any());
    }

    // --- updateSessionTitle ---

    @Test
    void updateSessionTitle_updatesTitle() {
        ChatSessionEntity session = createSession(1L, "Old Title");
        when(chatSessionRepository.findById(1L)).thenReturn(Optional.of(session));
        when(chatSessionRepository.save(session)).thenReturn(session);

        ChatSessionDto.SessionResponse result = chatSessionService.updateSessionTitle(1L, "New Title");

        assertEquals("New Title", session.getTitle());
        verify(chatSessionRepository).save(session);
    }

    @Test
    void updateSessionTitle_throwsWhenNotFound() {
        when(chatSessionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatSessionService.updateSessionTitle(999L, "Title"));
    }

    // --- deleteSession ---

    @Test
    void deleteSession_deletesExistingSession() {
        when(chatSessionRepository.existsById(1L)).thenReturn(true);

        chatSessionService.deleteSession(1L);

        verify(chatSessionRepository).deleteById(1L);
    }

    @Test
    void deleteSession_throwsWhenNotFound() {
        when(chatSessionRepository.existsById(999L)).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> chatSessionService.deleteSession(999L));
    }

    // --- saveMessages ---

    @Test
    void saveMessages_withExistingSession_addsMessages() {
        ChatSessionEntity session = createSession(1L, "Existing");
        when(chatSessionRepository.findById(1L)).thenReturn(Optional.of(session));

        Long result = chatSessionService.saveMessages(1L, "user question", "assistant answer");

        assertEquals(1L, result);
        verify(chatMessageRepository, times(2)).save(any(ChatMessageEntity.class));
    }

    @Test
    void saveMessages_withNullSessionId_createsNewSession() {
        ChatSessionEntity newSession = createSession(5L, null);
        when(chatSessionRepository.save(any())).thenReturn(newSession);

        Long result = chatSessionService.saveMessages(null, "How to test?", "Here is how...");

        assertEquals(5L, result);
        ArgumentCaptor<ChatSessionEntity> sessionCaptor = ArgumentCaptor.forClass(ChatSessionEntity.class);
        verify(chatSessionRepository).save(sessionCaptor.capture());
        assertNotNull(sessionCaptor.getValue().getTitle());
    }

    @Test
    void saveMessages_truncatesLongTitleTo50Chars() {
        ChatSessionEntity newSession = createSession(1L, null);
        when(chatSessionRepository.save(any())).thenReturn(newSession);

        String longMessage = "A".repeat(100);
        chatSessionService.saveMessages(null, longMessage, "response");

        ArgumentCaptor<ChatSessionEntity> captor = ArgumentCaptor.forClass(ChatSessionEntity.class);
        verify(chatSessionRepository).save(captor.capture());
        assertTrue(captor.getValue().getTitle().length() <= 54); // 50 + "..."
    }

    @Test
    void saveMessages_savesBothUserAndAssistantMessages() {
        ChatSessionEntity session = createSession(1L, "Session");
        when(chatSessionRepository.findById(1L)).thenReturn(Optional.of(session));

        chatSessionService.saveMessages(1L, "question", "answer");

        ArgumentCaptor<ChatMessageEntity> msgCaptor = ArgumentCaptor.forClass(ChatMessageEntity.class);
        verify(chatMessageRepository, times(2)).save(msgCaptor.capture());

        List<ChatMessageEntity> saved = msgCaptor.getAllValues();
        assertEquals("user", saved.get(0).getRole());
        assertEquals("question", saved.get(0).getContent());
        assertEquals("assistant", saved.get(1).getRole());
        assertEquals("answer", saved.get(1).getContent());
    }

    // --- Helpers ---

    private ChatSessionEntity createSession(Long id, String title) {
        ChatSessionEntity session = new ChatSessionEntity();
        session.setId(id);
        session.setTitle(title);
        session.setCreatedAt(now);
        session.setUpdatedAt(now);
        return session;
    }

    private ChatMessageEntity createMessage(Long id, ChatSessionEntity session, String role, String content) {
        ChatMessageEntity msg = new ChatMessageEntity();
        msg.setId(id);
        msg.setSession(session);
        msg.setRole(role);
        msg.setContent(content);
        msg.setCreatedAt(now);
        return msg;
    }
}
