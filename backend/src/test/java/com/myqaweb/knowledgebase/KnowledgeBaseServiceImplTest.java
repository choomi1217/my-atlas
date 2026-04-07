package com.myqaweb.knowledgebase;

import com.myqaweb.common.EmbeddingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for KnowledgeBaseServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceImplTest {

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Mock
    private EmbeddingService embeddingService;

    @InjectMocks
    private KnowledgeBaseServiceImpl knowledgeBaseService;

    private KnowledgeBaseEntity kb1;
    private KnowledgeBaseEntity kb2;
    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        now = LocalDateTime.now();
        kb1 = new KnowledgeBaseEntity(1L, "Regression Testing", "Best practices for regression",
                "Testing", "regression,best-practices", null, null, now, now);
        kb2 = new KnowledgeBaseEntity(2L, "API Testing", "How to test REST APIs",
                "API", "api,rest", null, null, now, now);
    }

    // --- findAll ---

    @Test
    void findAll_returnsAllItems() {
        // Arrange
        when(knowledgeBaseRepository.findAll()).thenReturn(List.of(kb1, kb2));

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll();

        // Assert
        assertEquals(2, result.size());
        assertEquals("Regression Testing", result.get(0).title());
        assertEquals("API Testing", result.get(1).title());
        verify(knowledgeBaseRepository).findAll();
    }

    @Test
    void findAll_returnsEmptyListWhenEmpty() {
        // Arrange
        when(knowledgeBaseRepository.findAll()).thenReturn(List.of());

        // Act
        List<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findAll();

        // Assert
        assertTrue(result.isEmpty());
    }

    // --- findById ---

    @Test
    void findById_returnsItemWhenExists() {
        // Arrange
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(kb1));

        // Act
        Optional<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findById(1L);

        // Assert
        assertTrue(result.isPresent());
        assertEquals("Regression Testing", result.get().title());
        assertEquals("Testing", result.get().category());
        verify(knowledgeBaseRepository).findById(1L);
    }

    @Test
    void findById_returnsEmptyWhenNotFound() {
        // Arrange
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        // Act
        Optional<KnowledgeBaseDto.KbResponse> result = knowledgeBaseService.findById(99L);

        // Assert
        assertTrue(result.isEmpty());
    }

    // --- create ---

    @Test
    void create_savesAndReturnsResponse() {
        // Arrange
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest(
                "New Article", "New content", "QA", "qa,new");
        KnowledgeBaseEntity savedEntity = new KnowledgeBaseEntity(
                3L, "New Article", "New content", "QA", "qa,new", null, null, now, now);
        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenReturn(savedEntity);

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.create(request);

        // Assert
        assertNotNull(result);
        assertEquals("New Article", result.title());
        assertEquals("QA", result.category());
        verify(knowledgeBaseRepository).save(any(KnowledgeBaseEntity.class));
    }

    // --- update ---

    @Test
    void update_updatesAndReturnsResponse() {
        // Arrange
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest(
                "Updated Title", "Updated Content", "Updated Category", "updated");
        KnowledgeBaseEntity existingEntity = new KnowledgeBaseEntity(
                1L, "Old", "Old", "Old", "old", null, null, now, now);
        KnowledgeBaseEntity savedEntity = new KnowledgeBaseEntity(
                1L, "Updated Title", "Updated Content", "Updated Category", "updated", null, null, now, now);

        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(existingEntity));
        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenReturn(savedEntity);

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.update(1L, request);

        // Assert
        assertNotNull(result);
        assertEquals("Updated Title", result.title());
        assertEquals("Updated Category", result.category());
        verify(knowledgeBaseRepository, atLeastOnce()).findById(1L);
        verify(knowledgeBaseRepository, atLeastOnce()).save(any(KnowledgeBaseEntity.class));
    }

    @Test
    void update_throwsWhenNotFound() {
        // Arrange
        KnowledgeBaseDto.KbRequest request = new KnowledgeBaseDto.KbRequest("T", "C", null, null);
        when(knowledgeBaseRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.update(99L, request)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
        verify(knowledgeBaseRepository, never()).save(any());
    }

    // --- delete ---

    @Test
    void delete_deletesWhenExists() {
        // Arrange
        when(knowledgeBaseRepository.existsById(1L)).thenReturn(true);

        // Act
        knowledgeBaseService.delete(1L);

        // Assert
        verify(knowledgeBaseRepository).existsById(1L);
        verify(knowledgeBaseRepository).deleteById(1L);
    }

    @Test
    void delete_throwsWhenNotFound() {
        // Arrange
        when(knowledgeBaseRepository.existsById(99L)).thenReturn(false);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> knowledgeBaseService.delete(99L)
        );
        assertTrue(ex.getMessage().contains("Knowledge Base entry not found"));
        verify(knowledgeBaseRepository, never()).deleteById(anyLong());
    }

    // --- Response mapping ---

    @Test
    void findById_mapsAllFieldsCorrectly() {
        // Arrange
        when(knowledgeBaseRepository.findById(1L)).thenReturn(Optional.of(kb1));

        // Act
        KnowledgeBaseDto.KbResponse result = knowledgeBaseService.findById(1L).orElseThrow();

        // Assert
        assertEquals(1L, result.id());
        assertEquals("Regression Testing", result.title());
        assertEquals("Best practices for regression", result.content());
        assertEquals("Testing", result.category());
        assertEquals("regression,best-practices", result.tags());
        assertEquals(now, result.createdAt());
        assertEquals(now, result.updatedAt());
    }
}
