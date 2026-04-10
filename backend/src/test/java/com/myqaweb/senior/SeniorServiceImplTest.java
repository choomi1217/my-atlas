package com.myqaweb.senior;

import com.myqaweb.common.EmbeddingService;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import com.myqaweb.knowledgebase.KnowledgeBaseService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SeniorServiceImpl — chat (RAG pipeline with KB hit count tracking)
 * and curated FAQ delegation to KnowledgeBaseService.
 */
@ExtendWith(MockitoExtension.class)
class SeniorServiceImplTest {

    @Mock
    private ChatClient chatClient;

    @Mock
    private EmbeddingService embeddingService;

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Mock
    private KnowledgeBaseService knowledgeBaseService;

    @Mock
    private ChatSessionService chatSessionService;

    @InjectMocks
    private SeniorServiceImpl seniorService;

    private final LocalDateTime now = LocalDateTime.now();

    // --- Helper: set up ChatClient mock chain ---

    private void setupChatClientMock() {
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.system(anyString())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("Hello", " World"));
    }

    private void setupMinimalRagMocks() {
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of());
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of());
    }

    // --- chat ---

    @Test
    void chat_withoutFaqContext_returnsSseEmitter() {
        // Arrange
        setupChatClientMock();
        setupMinimalRagMocks();

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null, null);

        // Act
        SseEmitter result = seniorService.chat(request);

        // Assert
        assertNotNull(result);
        verify(chatClient).prompt();
    }

    @Test
    void chat_withFaqContext_returnsSseEmitter() {
        // Arrange
        setupChatClientMock();
        setupMinimalRagMocks();

        ChatDto.FaqContext faqContext = new ChatDto.FaqContext("Login FAQ", "How to test login flow");
        ChatDto.ChatRequest request = new ChatDto.ChatRequest("Tell me more about login testing", faqContext, null);

        // Act
        SseEmitter result = seniorService.chat(request);

        // Assert
        assertNotNull(result);
        verify(chatClient).prompt();
    }

    @Test
    void chat_withFaqContext_includesFaqContextInSystemPrompt() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        setupMinimalRagMocks();

        ChatDto.FaqContext faqContext = new ChatDto.FaqContext("Login FAQ", "Step-by-step login testing");
        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", faqContext, null);

        // Act
        seniorService.chat(request);

        // Assert — verify the system prompt contains FAQ context
        String systemPrompt = systemCaptor.getValue();
        assertTrue(systemPrompt.contains("Login FAQ"), "System prompt should contain FAQ title");
        assertTrue(systemPrompt.contains("Step-by-step login testing"), "System prompt should contain FAQ content");
    }

    @Test
    void chat_withoutFaqContext_doesNotIncludeFaqSection() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        setupMinimalRagMocks();

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);

        // Act
        seniorService.chat(request);

        // Assert — verify the system prompt does NOT contain FAQ context section
        String systemPrompt = systemCaptor.getValue();
        assertFalse(systemPrompt.contains("FAQ 참고 항목"),
                "System prompt should NOT contain FAQ context section when faqContext is null");
    }

    // --- RAG Pipeline: KB Sources ---

    @Test
    void chat_withKbResults_combinesAllSourcesInContext() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        KnowledgeBaseEntity manualKb = new KnowledgeBaseEntity();
        manualKb.setTitle("Regression Best Practices");
        manualKb.setContent("Always run regression after hotfix.");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of(manualKb));

        KnowledgeBaseEntity pdfKb = new KnowledgeBaseEntity();
        pdfKb.setTitle("Book Chapter 5");
        pdfKb.setContent("Testing patterns from a book.");
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of(pdfKb));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);

        // Act
        seniorService.chat(request);

        // Assert
        String systemPrompt = systemCaptor.getValue();
        assertTrue(systemPrompt.contains("Regression Best Practices"), "Should contain manual KB entry");
        assertTrue(systemPrompt.contains("Book Chapter 5"), "Should contain PDF KB entry");
    }

    @Test
    void chat_whenEmbeddingServiceFails_stillStreamsResponse() {
        // Arrange
        setupChatClientMock();
        when(embeddingService.embed(anyString())).thenThrow(new RuntimeException("OpenAI API unavailable"));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null, null);

        // Act — should not throw, graceful degradation
        SseEmitter result = seniorService.chat(request);

        // Assert
        assertNotNull(result, "Chat should still return SSE emitter even if embedding fails");
        verify(chatClient).prompt();
    }

    // --- 2-Stage RAG: KB Manual vs PDF ---

    @Test
    void chat_uses2StageKbSearch_manualAndPdfSeparately() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        KnowledgeBaseEntity manualEntry = new KnowledgeBaseEntity();
        manualEntry.setTitle("Manual KB");
        manualEntry.setContent("User-written knowledge");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), eq(3))).thenReturn(List.of(manualEntry));

        KnowledgeBaseEntity pdfEntry = new KnowledgeBaseEntity();
        pdfEntry.setTitle("PDF Chapter");
        pdfEntry.setContent("Book-derived knowledge");
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), eq(2))).thenReturn(List.of(pdfEntry));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);

        // Act
        seniorService.chat(request);

        // Assert — verify 2-stage search is called with correct topK values
        verify(knowledgeBaseRepository).findSimilarManual(anyString(), eq(3));
        verify(knowledgeBaseRepository).findSimilarPdf(anyString(), eq(2));

        // Assert — verify prompt contains separated sections
        String systemPrompt = systemCaptor.getValue();
        assertTrue(systemPrompt.contains("직접 작성, 우선 참고"), "Should have manual KB section header");
        assertTrue(systemPrompt.contains("도서 참고"), "Should have PDF KB section header");
        assertTrue(systemPrompt.contains("Manual KB"), "Should contain manual entry");
        assertTrue(systemPrompt.contains("PDF Chapter"), "Should contain PDF entry");
    }

    @Test
    void chat_withOnlyManualKb_includesOnlyManualSection() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        KnowledgeBaseEntity manualEntry = new KnowledgeBaseEntity();
        manualEntry.setTitle("Manual Only");
        manualEntry.setContent("Only manual content");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of(manualEntry));
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of());

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("test question", null, null);

        // Act
        seniorService.chat(request);

        // Assert
        String systemPrompt = systemCaptor.getValue();
        assertTrue(systemPrompt.contains("직접 작성, 우선 참고"), "Should have manual section");
        assertFalse(systemPrompt.contains("도서 참고"), "Should NOT have PDF section when no PDF results");
    }

    @Test
    void chat_withOnlyPdfKb_includesOnlyPdfSection() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of());
        KnowledgeBaseEntity pdfEntry = new KnowledgeBaseEntity();
        pdfEntry.setTitle("PDF Only");
        pdfEntry.setContent("Only PDF content");
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of(pdfEntry));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("test question", null, null);

        // Act
        seniorService.chat(request);

        // Assert
        String systemPrompt = systemCaptor.getValue();
        assertFalse(systemPrompt.contains("직접 작성, 우선 참고"), "Should NOT have manual section when no manual results");
        assertTrue(systemPrompt.contains("도서 참고"), "Should have PDF section");
    }

    // --- chat: KB hit count tracking ---

    @Test
    void chat_incrementsHitCountsForRetrievedKbEntries() {
        // Arrange
        setupChatClientMock();
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        KnowledgeBaseEntity manualKb = new KnowledgeBaseEntity();
        manualKb.setId(10L);
        manualKb.setTitle("Manual Entry");
        manualKb.setContent("Content");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of(manualKb));

        KnowledgeBaseEntity pdfKb = new KnowledgeBaseEntity();
        pdfKb.setId(20L);
        pdfKb.setTitle("PDF Entry");
        pdfKb.setContent("PDF Content");
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of(pdfKb));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);

        // Act
        seniorService.chat(request);

        // Assert — verify incrementHitCount is called for each retrieved KB entry
        verify(knowledgeBaseRepository).incrementHitCount(10L);
        verify(knowledgeBaseRepository).incrementHitCount(20L);
    }

    @Test
    void chat_noKbResults_doesNotIncrementHitCounts() {
        // Arrange
        setupChatClientMock();
        setupMinimalRagMocks();

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);

        // Act
        seniorService.chat(request);

        // Assert — no hit count increments when no KB results
        verify(knowledgeBaseRepository, never()).incrementHitCount(anyLong());
    }

    // --- getCuratedFaqs ---

    @Test
    void getCuratedFaqs_delegatesToKnowledgeBaseService() {
        // Arrange
        List<KnowledgeBaseDto.KbResponse> expectedFaqs = List.of(
                new KnowledgeBaseDto.KbResponse(1L, "Pinned Entry", "Content", "QA", "qa",
                        null, 0, now, now, now),
                new KnowledgeBaseDto.KbResponse(2L, "Top Hit", "Content", "API", "api",
                        null, 5, null, now, now)
        );
        when(knowledgeBaseService.getCuratedFaqs()).thenReturn(expectedFaqs);

        // Act
        List<KnowledgeBaseDto.KbResponse> result = seniorService.getCuratedFaqs();

        // Assert
        assertEquals(2, result.size());
        assertEquals("Pinned Entry", result.get(0).title());
        assertEquals("Top Hit", result.get(1).title());
        verify(knowledgeBaseService).getCuratedFaqs();
    }

    @Test
    void getCuratedFaqs_returnsEmptyListWhenNoCuratedEntries() {
        // Arrange
        when(knowledgeBaseService.getCuratedFaqs()).thenReturn(List.of());

        // Act
        List<KnowledgeBaseDto.KbResponse> result = seniorService.getCuratedFaqs();

        // Assert
        assertTrue(result.isEmpty());
        verify(knowledgeBaseService).getCuratedFaqs();
    }
}
