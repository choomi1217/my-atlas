package com.myqaweb.senior;

import com.myqaweb.common.EmbeddingService;
import com.myqaweb.common.SlackNotificationService;
import com.myqaweb.knowledgebase.KnowledgeBaseDto;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import com.myqaweb.knowledgebase.KnowledgeBaseService;
import com.myqaweb.monitoring.AiUsageLogService;
import com.myqaweb.settings.SettingsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
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

    @Mock
    private AiUsageLogService aiUsageLogService;

    @Mock
    private SettingsService settingsService;

    @Mock
    private SlackNotificationService slackNotificationService;

    @InjectMocks
    private SeniorServiceImpl seniorService;

    private final LocalDateTime now = LocalDateTime.now();

    // --- Helpers ---

    private void setupSettingsMock() {
        lenient().when(settingsService.isAiEnabled()).thenReturn(true);
    }

    private void setupChatClientMock() {
        setupSettingsMock();
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.system(anyString())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.chatResponse()).thenReturn(Flux.just(
                mockChatResponse("Hello"),
                mockChatResponse(" World")
        ));
    }

    private ChatResponse mockChatResponse(String content) {
        Generation generation = new Generation(content);
        return new ChatResponse(List.of(generation));
    }

    private void setupMinimalRagMocks() {
        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of());
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of());
    }

    // --- Helper for capturing system prompt ---

    private record ChatClientMocks(
            ChatClient.ChatClientRequest clientRequest,
            ArgumentCaptor<String> systemCaptor
    ) {}

    private ChatClientMocks setupChatClientWithCaptor() {
        setupSettingsMock();
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.chatResponse()).thenReturn(Flux.just(mockChatResponse("response")));

        return new ChatClientMocks(clientRequest, systemCaptor);
    }

    // --- chat ---

    @Test
    void chat_withoutFaqContext_returnsSseEmitter() {
        setupChatClientMock();
        setupMinimalRagMocks();

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null, null);
        SseEmitter result = seniorService.chat(request);

        assertNotNull(result);
        verify(chatClient).prompt();
    }

    @Test
    void chat_withFaqContext_returnsSseEmitter() {
        setupChatClientMock();
        setupMinimalRagMocks();

        ChatDto.FaqContext faqContext = new ChatDto.FaqContext("Login FAQ", "How to test login flow");
        ChatDto.ChatRequest request = new ChatDto.ChatRequest("Tell me more about login testing", faqContext, null);

        SseEmitter result = seniorService.chat(request);

        assertNotNull(result);
        verify(chatClient).prompt();
    }

    @Test
    void chat_withFaqContext_includesFaqContextInSystemPrompt() {
        ChatClientMocks mocks = setupChatClientWithCaptor();
        setupMinimalRagMocks();

        ChatDto.FaqContext faqContext = new ChatDto.FaqContext("Login FAQ", "Step-by-step login testing");
        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", faqContext, null);

        seniorService.chat(request);

        String systemPrompt = mocks.systemCaptor().getValue();
        assertTrue(systemPrompt.contains("Login FAQ"));
        assertTrue(systemPrompt.contains("Step-by-step login testing"));
    }

    @Test
    void chat_withoutFaqContext_doesNotIncludeFaqSection() {
        ChatClientMocks mocks = setupChatClientWithCaptor();
        setupMinimalRagMocks();

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);

        seniorService.chat(request);

        String systemPrompt = mocks.systemCaptor().getValue();
        assertFalse(systemPrompt.contains("FAQ 참고 항목"));
    }

    // --- RAG Pipeline: KB Sources ---

    @Test
    void chat_withKbResults_combinesAllSourcesInContext() {
        ChatClientMocks mocks = setupChatClientWithCaptor();

        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
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
        seniorService.chat(request);

        String systemPrompt = mocks.systemCaptor().getValue();
        assertTrue(systemPrompt.contains("Regression Best Practices"));
        assertTrue(systemPrompt.contains("Book Chapter 5"));
    }

    @Test
    void chat_whenEmbeddingServiceFails_stillStreamsResponse() {
        setupChatClientMock();
        when(embeddingService.embed(anyString(), any())).thenThrow(new RuntimeException("OpenAI API unavailable"));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null, null);
        SseEmitter result = seniorService.chat(request);

        assertNotNull(result);
        verify(chatClient).prompt();
    }

    // --- 2-Stage RAG: KB Manual vs PDF ---

    @Test
    void chat_uses2StageKbSearch_manualAndPdfSeparately() {
        ChatClientMocks mocks = setupChatClientWithCaptor();

        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
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
        seniorService.chat(request);

        verify(knowledgeBaseRepository).findSimilarManual(anyString(), eq(3));
        verify(knowledgeBaseRepository).findSimilarPdf(anyString(), eq(2));

        String systemPrompt = mocks.systemCaptor().getValue();
        assertTrue(systemPrompt.contains("직접 작성, 우선 참고"));
        assertTrue(systemPrompt.contains("도서 참고"));
        assertTrue(systemPrompt.contains("Manual KB"));
        assertTrue(systemPrompt.contains("PDF Chapter"));
    }

    @Test
    void chat_withOnlyManualKb_includesOnlyManualSection() {
        ChatClientMocks mocks = setupChatClientWithCaptor();

        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        KnowledgeBaseEntity manualEntry = new KnowledgeBaseEntity();
        manualEntry.setTitle("Manual Only");
        manualEntry.setContent("Only manual content");
        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of(manualEntry));
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of());

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("test question", null, null);
        seniorService.chat(request);

        String systemPrompt = mocks.systemCaptor().getValue();
        assertTrue(systemPrompt.contains("직접 작성, 우선 참고"));
        assertFalse(systemPrompt.contains("도서 참고"));
    }

    @Test
    void chat_withOnlyPdfKb_includesOnlyPdfSection() {
        ChatClientMocks mocks = setupChatClientWithCaptor();

        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        when(knowledgeBaseRepository.findSimilarManual(anyString(), anyInt())).thenReturn(List.of());
        KnowledgeBaseEntity pdfEntry = new KnowledgeBaseEntity();
        pdfEntry.setTitle("PDF Only");
        pdfEntry.setContent("Only PDF content");
        when(knowledgeBaseRepository.findSimilarPdf(anyString(), anyInt())).thenReturn(List.of(pdfEntry));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("test question", null, null);
        seniorService.chat(request);

        String systemPrompt = mocks.systemCaptor().getValue();
        assertFalse(systemPrompt.contains("직접 작성, 우선 참고"));
        assertTrue(systemPrompt.contains("도서 참고"));
    }

    // --- chat: KB hit count tracking ---

    @Test
    void chat_incrementsHitCountsForRetrievedKbEntries() {
        setupChatClientMock();
        when(embeddingService.embed(anyString(), any())).thenReturn(new float[]{0.1f});
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
        seniorService.chat(request);

        verify(knowledgeBaseRepository).incrementHitCount(10L);
        verify(knowledgeBaseRepository).incrementHitCount(20L);
    }

    @Test
    void chat_noKbResults_doesNotIncrementHitCounts() {
        setupChatClientMock();
        setupMinimalRagMocks();

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null, null);
        seniorService.chat(request);

        verify(knowledgeBaseRepository, never()).incrementHitCount(anyLong());
    }

    // --- getCuratedFaqs ---

    @Test
    void getCuratedFaqs_delegatesToKnowledgeBaseService() {
        List<KnowledgeBaseDto.KbResponse> expectedFaqs = List.of(
                new KnowledgeBaseDto.KbResponse(1L, "Pinned Entry", "Content", "QA",
                        null, 0, now, now, now, null),
                new KnowledgeBaseDto.KbResponse(2L, "Top Hit", "Content", "API",
                        null, 5, null, now, now, null)
        );
        when(knowledgeBaseService.getCuratedFaqs()).thenReturn(expectedFaqs);

        List<KnowledgeBaseDto.KbResponse> result = seniorService.getCuratedFaqs();

        assertEquals(2, result.size());
        assertEquals("Pinned Entry", result.get(0).title());
        assertEquals("Top Hit", result.get(1).title());
        verify(knowledgeBaseService).getCuratedFaqs();
    }

    @Test
    void getCuratedFaqs_returnsEmptyListWhenNoCuratedEntries() {
        when(knowledgeBaseService.getCuratedFaqs()).thenReturn(List.of());

        List<KnowledgeBaseDto.KbResponse> result = seniorService.getCuratedFaqs();

        assertTrue(result.isEmpty());
        verify(knowledgeBaseService).getCuratedFaqs();
    }
}
