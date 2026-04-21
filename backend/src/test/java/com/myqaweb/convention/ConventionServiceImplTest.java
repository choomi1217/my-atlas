package com.myqaweb.convention;

import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ConventionServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class ConventionServiceImplTest {

    @Mock
    private ConventionRepository conventionRepository;

    @Mock
    private WordCategoryService wordCategoryService;

    @InjectMocks
    private ConventionServiceImpl conventionService;

    private ConventionEntity conv1;
    private ConventionEntity conv2;
    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        now = LocalDateTime.now();
        conv1 = new ConventionEntity(1L, "TC", "Test Case", "Testing", "/api/convention-images/tc.png", now, now);
        conv2 = new ConventionEntity(2L, "QA", "Quality Assurance", "General", null, now, null);
    }

    // --- findAll ---

    @Test
    void findAll_returnsAllConventions() {
        // Arrange
        when(conventionRepository.findAll()).thenReturn(List.of(conv1, conv2));

        // Act
        List<ConventionDto.ConventionResponse> result = conventionService.findAll();

        // Assert
        assertEquals(2, result.size());
        assertEquals("TC", result.get(0).term());
        assertEquals("QA", result.get(1).term());
        verify(conventionRepository).findAll();
    }

    @Test
    void findAll_returnsEmptyList() {
        // Arrange
        when(conventionRepository.findAll()).thenReturn(List.of());

        // Act
        List<ConventionDto.ConventionResponse> result = conventionService.findAll();

        // Assert
        assertTrue(result.isEmpty());
    }

    // --- findById ---

    @Test
    void findById_returnsWhenExists() {
        // Arrange
        when(conventionRepository.findById(1L)).thenReturn(Optional.of(conv1));

        // Act
        Optional<ConventionDto.ConventionResponse> result = conventionService.findById(1L);

        // Assert
        assertTrue(result.isPresent());
        assertEquals("TC", result.get().term());
        assertEquals("Test Case", result.get().definition());
        verify(conventionRepository).findById(1L);
    }

    @Test
    void findById_returnsEmptyWhenNotFound() {
        // Arrange
        when(conventionRepository.findById(99L)).thenReturn(Optional.empty());

        // Act
        Optional<ConventionDto.ConventionResponse> result = conventionService.findById(99L);

        // Assert
        assertTrue(result.isEmpty());
    }

    // --- create ---

    @Test
    void create_savesAndReturnsResponse() {
        // Arrange
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest(
                "BDD", "Behavior Driven Development", "Methodology", null);
        ConventionEntity savedEntity = new ConventionEntity(
                3L, "BDD", "Behavior Driven Development", "Methodology", null, now, now);
        when(conventionRepository.save(any(ConventionEntity.class))).thenReturn(savedEntity);

        // Act
        ConventionDto.ConventionResponse result = conventionService.create(request);

        // Assert
        assertNotNull(result);
        assertEquals("BDD", result.term());
        assertEquals("Behavior Driven Development", result.definition());
        assertEquals("Methodology", result.category());
        assertNull(result.imageUrl());
        verify(conventionRepository).save(any(ConventionEntity.class));
    }

    @Test
    void create_withImageUrl_savesImageUrl() {
        // Arrange
        String imageUrl = "/api/convention-images/test.png";
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest(
                "BDD", "Behavior Driven Development", "Methodology", imageUrl);
        ConventionEntity savedEntity = new ConventionEntity(
                3L, "BDD", "Behavior Driven Development", "Methodology", imageUrl, now, now);
        when(conventionRepository.save(any(ConventionEntity.class))).thenReturn(savedEntity);

        // Act
        ConventionDto.ConventionResponse result = conventionService.create(request);

        // Assert
        assertNotNull(result);
        assertEquals(imageUrl, result.imageUrl());

        ArgumentCaptor<ConventionEntity> captor = ArgumentCaptor.forClass(ConventionEntity.class);
        verify(conventionRepository).save(captor.capture());
        assertEquals(imageUrl, captor.getValue().getImageUrl());
    }

    @Test
    void create_withNullImageUrl_savesNullImageUrl() {
        // Arrange
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest(
                "TC", "Test Case", "Testing", null);
        ConventionEntity savedEntity = new ConventionEntity(
                1L, "TC", "Test Case", "Testing", null, now, now);
        when(conventionRepository.save(any(ConventionEntity.class))).thenReturn(savedEntity);

        // Act
        ConventionDto.ConventionResponse result = conventionService.create(request);

        // Assert
        assertNull(result.imageUrl());

        ArgumentCaptor<ConventionEntity> captor = ArgumentCaptor.forClass(ConventionEntity.class);
        verify(conventionRepository).save(captor.capture());
        assertNull(captor.getValue().getImageUrl());
    }

    @Test
    void create_setsUpdatedAt() {
        // Arrange
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest(
                "TC", "Test Case", "Testing", null);
        ConventionEntity savedEntity = new ConventionEntity(
                1L, "TC", "Test Case", "Testing", null, now, now);
        when(conventionRepository.save(any(ConventionEntity.class))).thenReturn(savedEntity);

        // Act
        conventionService.create(request);

        // Assert
        ArgumentCaptor<ConventionEntity> captor = ArgumentCaptor.forClass(ConventionEntity.class);
        verify(conventionRepository).save(captor.capture());
        assertNotNull(captor.getValue().getUpdatedAt());
    }

    // --- update ---

    @Test
    void update_updatesAndReturns() {
        // Arrange
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest(
                "TC Updated", "Test Case Updated", "Testing", null);
        ConventionEntity savedEntity = new ConventionEntity(
                1L, "TC Updated", "Test Case Updated", "Testing", null, now, now);
        when(conventionRepository.findById(1L)).thenReturn(Optional.of(conv1));
        when(conventionRepository.save(any(ConventionEntity.class))).thenReturn(savedEntity);

        // Act
        ConventionDto.ConventionResponse result = conventionService.update(1L, request);

        // Assert
        assertNotNull(result);
        assertEquals("TC Updated", result.term());
        verify(conventionRepository).findById(1L);
        verify(conventionRepository).save(any(ConventionEntity.class));
    }

    @Test
    void update_setsUpdatedAtAndImageUrl() {
        // Arrange
        String newImageUrl = "/api/convention-images/updated.png";
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest(
                "TC Updated", "Test Case Updated", "Testing", newImageUrl);
        ConventionEntity savedEntity = new ConventionEntity(
                1L, "TC Updated", "Test Case Updated", "Testing", newImageUrl, now, now);
        when(conventionRepository.findById(1L)).thenReturn(Optional.of(conv1));
        when(conventionRepository.save(any(ConventionEntity.class))).thenReturn(savedEntity);

        // Act
        ConventionDto.ConventionResponse result = conventionService.update(1L, request);

        // Assert
        assertEquals(newImageUrl, result.imageUrl());

        ArgumentCaptor<ConventionEntity> captor = ArgumentCaptor.forClass(ConventionEntity.class);
        verify(conventionRepository).save(captor.capture());
        assertEquals(newImageUrl, captor.getValue().getImageUrl());
        assertNotNull(captor.getValue().getUpdatedAt());
    }

    @Test
    void update_throwsWhenNotFound() {
        // Arrange
        ConventionDto.ConventionRequest request = new ConventionDto.ConventionRequest("T", "D", null, null);
        when(conventionRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> conventionService.update(99L, request)
        );
        assertTrue(ex.getMessage().contains("Convention not found"));
        verify(conventionRepository, never()).save(any());
    }

    // --- delete ---

    @Test
    void delete_deletesWhenExists() {
        // Arrange
        when(conventionRepository.existsById(1L)).thenReturn(true);

        // Act
        conventionService.delete(1L);

        // Assert
        verify(conventionRepository).existsById(1L);
        verify(conventionRepository).deleteById(1L);
    }

    @Test
    void delete_throwsWhenNotFound() {
        // Arrange
        when(conventionRepository.existsById(99L)).thenReturn(false);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> conventionService.delete(99L)
        );
        assertTrue(ex.getMessage().contains("Convention not found"));
        verify(conventionRepository, never()).deleteById(anyLong());
    }

    // --- Response mapping ---

    @Test
    void findById_mapsAllFieldsCorrectly() {
        // Arrange
        when(conventionRepository.findById(1L)).thenReturn(Optional.of(conv1));

        // Act
        ConventionDto.ConventionResponse result = conventionService.findById(1L).orElseThrow();

        // Assert
        assertEquals(1L, result.id());
        assertEquals("TC", result.term());
        assertEquals("Test Case", result.definition());
        assertEquals("Testing", result.category());
        assertEquals("/api/convention-images/tc.png", result.imageUrl());
        assertEquals(now, result.createdAt());
        assertEquals(now, result.updatedAt());
    }

    @Test
    void findById_mapsNullImageUrlAndUpdatedAt() {
        // Arrange
        when(conventionRepository.findById(2L)).thenReturn(Optional.of(conv2));

        // Act
        ConventionDto.ConventionResponse result = conventionService.findById(2L).orElseThrow();

        // Assert
        assertEquals(2L, result.id());
        assertNull(result.imageUrl());
        assertNull(result.updatedAt());
    }
}
