package com.myqaweb.senior;

import com.myqaweb.common.EmbeddingService;
import com.myqaweb.convention.ConventionRepository;
import com.myqaweb.convention.ConventionEntity;
import com.myqaweb.feature.*;
import com.myqaweb.knowledgebase.KnowledgeBaseEntity;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SeniorServiceImpl — chat (with/without FAQ context) and FAQ CRUD operations.
 */
@ExtendWith(MockitoExtension.class)
class SeniorServiceImplTest {

    @Mock
    private ChatClient chatClient;

    @Mock
    private EmbeddingService embeddingService;

    @Mock
    private FaqRepository faqRepository;

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private SegmentRepository segmentRepository;

    @Mock
    private ConventionRepository conventionRepository;

    @InjectMocks
    private SeniorServiceImpl seniorService;

    private FaqEntity faq1;
    private FaqEntity faq2;
    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        now = LocalDateTime.now();
        faq1 = new FaqEntity(1L, "Login FAQ", "How to test login", "auth,login", null, now, now);
        faq2 = new FaqEntity(2L, "API FAQ", "How to test REST APIs", "api,rest", null, now, now);
    }

    // --- chat ---

    private void setupChatClientMock() {
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        when(clientRequest.system(anyString())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("Hello", " World"));
    }

    @Test
    void chat_withoutFaqContext_returnsSseEmitter() {
        // Arrange
        setupChatClientMock();
        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(faqRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null);

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
        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(faqRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());

        ChatDto.FaqContext faqContext = new ChatDto.FaqContext("Login FAQ", "How to test login flow");
        ChatDto.ChatRequest request = new ChatDto.ChatRequest("Tell me more about login testing", faqContext);

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

        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(faqRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());

        ChatDto.FaqContext faqContext = new ChatDto.FaqContext("Login FAQ", "Step-by-step login testing");
        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", faqContext);

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

        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(faqRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null);

        // Act
        seniorService.chat(request);

        // Assert — verify the system prompt does NOT contain FAQ context section
        String systemPrompt = systemCaptor.getValue();
        assertFalse(systemPrompt.contains("FAQ 참고 항목"), "System prompt should NOT contain FAQ context section when faqContext is null");
    }

    // --- findAllFaqs ---

    @Test
    void findAllFaqs_returnsAllFaqs() {
        // Arrange
        when(faqRepository.findAll()).thenReturn(List.of(faq1, faq2));

        // Act
        List<FaqDto.FaqResponse> result = seniorService.findAllFaqs();

        // Assert
        assertEquals(2, result.size());
        assertEquals("Login FAQ", result.get(0).title());
        assertEquals("API FAQ", result.get(1).title());
        verify(faqRepository).findAll();
    }

    @Test
    void findAllFaqs_returnsEmptyListWhenNoFaqs() {
        // Arrange
        when(faqRepository.findAll()).thenReturn(List.of());

        // Act
        List<FaqDto.FaqResponse> result = seniorService.findAllFaqs();

        // Assert
        assertTrue(result.isEmpty());
        verify(faqRepository).findAll();
    }

    // --- findFaqById ---

    @Test
    void findFaqById_returnsFaqWhenExists() {
        // Arrange
        when(faqRepository.findById(1L)).thenReturn(Optional.of(faq1));

        // Act
        Optional<FaqDto.FaqResponse> result = seniorService.findFaqById(1L);

        // Assert
        assertTrue(result.isPresent());
        assertEquals("Login FAQ", result.get().title());
        assertEquals("How to test login", result.get().content());
        assertEquals("auth,login", result.get().tags());
        verify(faqRepository).findById(1L);
    }

    @Test
    void findFaqById_returnsEmptyWhenNotFound() {
        // Arrange
        when(faqRepository.findById(99L)).thenReturn(Optional.empty());

        // Act
        Optional<FaqDto.FaqResponse> result = seniorService.findFaqById(99L);

        // Assert
        assertTrue(result.isEmpty());
        verify(faqRepository).findById(99L);
    }

    // --- createFaq ---

    @Test
    void createFaq_savesAndReturnsResponse() {
        // Arrange
        FaqDto.FaqRequest request = new FaqDto.FaqRequest("New FAQ", "New content", "tag1");
        FaqEntity savedEntity = new FaqEntity(3L, "New FAQ", "New content", "tag1", null, now, now);
        when(faqRepository.save(any(FaqEntity.class))).thenReturn(savedEntity);

        // Act
        FaqDto.FaqResponse result = seniorService.createFaq(request);

        // Assert
        assertNotNull(result);
        assertEquals("New FAQ", result.title());
        assertEquals("New content", result.content());
        assertEquals("tag1", result.tags());
        verify(faqRepository).save(any(FaqEntity.class));
    }

    // --- updateFaq ---

    @Test
    void updateFaq_updatesAndReturnsResponse() {
        // Arrange
        FaqDto.FaqRequest request = new FaqDto.FaqRequest("Updated Title", "Updated Content", "newtag");
        FaqEntity existingEntity = new FaqEntity(1L, "Old Title", "Old Content", "oldtag", null, now, now);
        FaqEntity savedEntity = new FaqEntity(1L, "Updated Title", "Updated Content", "newtag", null, now, now);

        when(faqRepository.findById(1L)).thenReturn(Optional.of(existingEntity));
        when(faqRepository.save(any(FaqEntity.class))).thenReturn(savedEntity);

        // Act
        FaqDto.FaqResponse result = seniorService.updateFaq(1L, request);

        // Assert
        assertNotNull(result);
        assertEquals("Updated Title", result.title());
        assertEquals("Updated Content", result.content());
        verify(faqRepository).findById(1L);
        verify(faqRepository).save(any(FaqEntity.class));
    }

    @Test
    void updateFaq_throwsWhenNotFound() {
        // Arrange
        FaqDto.FaqRequest request = new FaqDto.FaqRequest("Title", "Content", null);
        when(faqRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> seniorService.updateFaq(99L, request)
        );
        assertTrue(ex.getMessage().contains("FAQ not found"));
        verify(faqRepository).findById(99L);
        verify(faqRepository, never()).save(any());
    }

    // --- deleteFaq ---

    @Test
    void deleteFaq_deletesWhenExists() {
        // Arrange
        when(faqRepository.existsById(1L)).thenReturn(true);

        // Act
        seniorService.deleteFaq(1L);

        // Assert
        verify(faqRepository).existsById(1L);
        verify(faqRepository).deleteById(1L);
    }

    @Test
    void deleteFaq_throwsWhenNotFound() {
        // Arrange
        when(faqRepository.existsById(99L)).thenReturn(false);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> seniorService.deleteFaq(99L)
        );
        assertTrue(ex.getMessage().contains("FAQ not found"));
        verify(faqRepository).existsById(99L);
        verify(faqRepository, never()).deleteById(anyLong());
    }

    // --- RAG Pipeline: Active Company ---

    @Test
    void chat_withActiveCompany_includesProductsAndSegmentsInContext() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        CompanyEntity company = new CompanyEntity(1L, "TestCorp", true, now);
        ProductEntity product = new ProductEntity(1L, company, "WebApp", Platform.WEB, "Main web app", now);
        SegmentEntity segment = new SegmentEntity();
        segment.setId(1L);
        segment.setName("Login Module");

        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.of(company));
        when(productRepository.findAllByCompanyId(1L)).thenReturn(List.of(product));
        when(segmentRepository.findAllByProductId(1L)).thenReturn(List.of(segment));
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");
        when(knowledgeBaseRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(faqRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of());
        when(conventionRepository.findAll()).thenReturn(List.of());

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null);

        // Act
        seniorService.chat(request);

        // Assert
        String systemPrompt = systemCaptor.getValue();
        assertTrue(systemPrompt.contains("TestCorp"), "Should contain company name");
        assertTrue(systemPrompt.contains("WebApp"), "Should contain product name");
        assertTrue(systemPrompt.contains("Login Module"), "Should contain segment name");
    }

    @Test
    void chat_withKbAndFaqResults_combinesAllSourcesInContext() {
        // Arrange
        ChatClient.ChatClientRequest clientRequest = mock(ChatClient.ChatClientRequest.class);
        ChatClient.ChatClientRequest.StreamResponseSpec streamSpec = mock(ChatClient.ChatClientRequest.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(clientRequest);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        when(clientRequest.system(systemCaptor.capture())).thenReturn(clientRequest);
        when(clientRequest.user(anyString())).thenReturn(clientRequest);
        when(clientRequest.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("response"));

        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(embeddingService.embed(anyString())).thenReturn(new float[]{0.1f});
        when(embeddingService.toVectorString(any(float[].class))).thenReturn("[0.1]");

        KnowledgeBaseEntity kbEntry = new KnowledgeBaseEntity();
        kbEntry.setTitle("Regression Best Practices");
        kbEntry.setContent("Always run regression after hotfix.");
        when(knowledgeBaseRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of(kbEntry));

        FaqEntity faqEntry = new FaqEntity(10L, "My Login Notes", "Check OAuth flow", null, null, now, now);
        when(faqRepository.findSimilar(anyString(), anyInt())).thenReturn(List.of(faqEntry));

        ConventionEntity conv = new ConventionEntity(1L, "TC", "Test Case", "Testing", now);
        when(conventionRepository.findAll()).thenReturn(List.of(conv));

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test?", null);

        // Act
        seniorService.chat(request);

        // Assert
        String systemPrompt = systemCaptor.getValue();
        assertTrue(systemPrompt.contains("Regression Best Practices"), "Should contain KB entry");
        assertTrue(systemPrompt.contains("My Login Notes"), "Should contain FAQ entry");
        assertTrue(systemPrompt.contains("TC"), "Should contain convention term");
    }

    @Test
    void chat_whenEmbeddingServiceFails_stillStreamsResponse() {
        // Arrange
        setupChatClientMock();
        when(companyRepository.findByIsActiveTrue()).thenReturn(Optional.empty());
        when(embeddingService.embed(anyString())).thenThrow(new RuntimeException("OpenAI API unavailable"));
        when(conventionRepository.findAll()).thenReturn(List.of());

        ChatDto.ChatRequest request = new ChatDto.ChatRequest("How to test login?", null);

        // Act — should not throw, graceful degradation
        SseEmitter result = seniorService.chat(request);

        // Assert
        assertNotNull(result, "Chat should still return SSE emitter even if embedding fails");
        verify(chatClient).prompt();
    }

    // --- Response mapping ---

    @Test
    void findFaqById_mapsAllFieldsCorrectly() {
        // Arrange
        FaqEntity entity = new FaqEntity(5L, "Title", "Content", "tags", new float[]{0.1f}, now, now);
        when(faqRepository.findById(5L)).thenReturn(Optional.of(entity));

        // Act
        FaqDto.FaqResponse result = seniorService.findFaqById(5L).orElseThrow();

        // Assert
        assertEquals(5L, result.id());
        assertEquals("Title", result.title());
        assertEquals("Content", result.content());
        assertEquals("tags", result.tags());
        assertEquals(now, result.createdAt());
        assertEquals(now, result.updatedAt());
    }
}
