package com.myqaweb.senior;

import com.myqaweb.common.EmbeddingService;
import com.myqaweb.convention.ConventionRepository;
import com.myqaweb.feature.CompanyRepository;
import com.myqaweb.feature.ProductRepository;
import com.myqaweb.feature.SegmentRepository;
import com.myqaweb.knowledgebase.KnowledgeBaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SeniorServiceImpl — FAQ CRUD operations.
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
