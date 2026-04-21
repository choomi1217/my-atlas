package com.myqaweb.convention;

import com.myqaweb.common.CategoryDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WordCategoryServiceImplTest {

    @Mock
    private WordCategoryRepository categoryRepository;

    @InjectMocks
    private WordCategoryServiceImpl categoryService;

    private final LocalDateTime now = LocalDateTime.now();

    @Test
    void findAll_returnsAllCategories() {
        WordCategoryEntity cat1 = new WordCategoryEntity(1L, "UI", now);
        WordCategoryEntity cat2 = new WordCategoryEntity(2L, "API", now);
        when(categoryRepository.findAll()).thenReturn(List.of(cat1, cat2));

        List<CategoryDto.CategoryResponse> result = categoryService.findAll();

        assertEquals(2, result.size());
        assertEquals("UI", result.get(0).name());
        assertEquals("API", result.get(1).name());
    }

    @Test
    void findAll_returnsEmptyWhenNoCategories() {
        when(categoryRepository.findAll()).thenReturn(List.of());

        List<CategoryDto.CategoryResponse> result = categoryService.findAll();

        assertTrue(result.isEmpty());
    }

    @Test
    void search_filtersCategories() {
        WordCategoryEntity cat1 = new WordCategoryEntity(1L, "UI Components", now);
        when(categoryRepository.findByNameContainingIgnoreCaseOrderByNameAsc("ui"))
                .thenReturn(List.of(cat1));

        List<CategoryDto.CategoryResponse> result = categoryService.search("ui");

        assertEquals(1, result.size());
        assertEquals("UI Components", result.get(0).name());
    }

    @Test
    void search_emptyQuery_returnsAll() {
        WordCategoryEntity cat1 = new WordCategoryEntity(1L, "UI", now);
        when(categoryRepository.findAll()).thenReturn(List.of(cat1));

        List<CategoryDto.CategoryResponse> result = categoryService.search("");

        assertEquals(1, result.size());
    }

    @Test
    void search_nullQuery_returnsAll() {
        WordCategoryEntity cat1 = new WordCategoryEntity(1L, "UI", now);
        when(categoryRepository.findAll()).thenReturn(List.of(cat1));

        List<CategoryDto.CategoryResponse> result = categoryService.search(null);

        assertEquals(1, result.size());
    }

    @Test
    void create_savesNewCategory() {
        WordCategoryEntity saved = new WordCategoryEntity(1L, "NewCat", now);
        when(categoryRepository.existsByName("NewCat")).thenReturn(false);
        when(categoryRepository.save(any())).thenReturn(saved);

        CategoryDto.CategoryResponse result = categoryService.create("NewCat");

        assertEquals("NewCat", result.name());
        verify(categoryRepository).save(any());
    }

    @Test
    void create_trimsName() {
        WordCategoryEntity saved = new WordCategoryEntity(1L, "Trimmed", now);
        when(categoryRepository.existsByName("Trimmed")).thenReturn(false);
        when(categoryRepository.save(any())).thenReturn(saved);

        categoryService.create("  Trimmed  ");

        verify(categoryRepository).existsByName("Trimmed");
    }

    @Test
    void create_throwsWhenDuplicate() {
        when(categoryRepository.existsByName("Existing")).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> categoryService.create("Existing"));
        verify(categoryRepository, never()).save(any());
    }

    @Test
    void ensureExists_createsWhenNotExists() {
        when(categoryRepository.existsByName("NewCat")).thenReturn(false);

        categoryService.ensureExists("NewCat");

        verify(categoryRepository).save(any());
    }

    @Test
    void ensureExists_skipsWhenAlreadyExists() {
        when(categoryRepository.existsByName("Existing")).thenReturn(true);

        categoryService.ensureExists("Existing");

        verify(categoryRepository, never()).save(any());
    }

    @Test
    void ensureExists_skipsWhenNull() {
        categoryService.ensureExists(null);

        verify(categoryRepository, never()).existsByName(any());
    }

    @Test
    void ensureExists_skipsWhenBlank() {
        categoryService.ensureExists("  ");

        verify(categoryRepository, never()).existsByName(any());
    }

    @Test
    void ensureExists_trimsBeforeCheck() {
        when(categoryRepository.existsByName("UI")).thenReturn(false);

        categoryService.ensureExists("  UI  ");

        verify(categoryRepository).existsByName("UI");
    }
}
