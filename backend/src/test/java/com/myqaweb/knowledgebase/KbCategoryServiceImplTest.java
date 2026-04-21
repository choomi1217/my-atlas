package com.myqaweb.knowledgebase;

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
class KbCategoryServiceImplTest {

    @Mock
    private KbCategoryRepository categoryRepository;

    @InjectMocks
    private KbCategoryServiceImpl categoryService;

    private final LocalDateTime now = LocalDateTime.now();

    @Test
    void findAll_returnsAllCategories() {
        KbCategoryEntity cat1 = new KbCategoryEntity(1L, "Testing", now);
        KbCategoryEntity cat2 = new KbCategoryEntity(2L, "Automation", now);
        when(categoryRepository.findAll()).thenReturn(List.of(cat1, cat2));

        List<CategoryDto.CategoryResponse> result = categoryService.findAll();

        assertEquals(2, result.size());
        assertEquals("Testing", result.get(0).name());
        assertEquals("Automation", result.get(1).name());
    }

    @Test
    void search_filtersCategories() {
        KbCategoryEntity cat1 = new KbCategoryEntity(1L, "Test Design", now);
        when(categoryRepository.findByNameContainingIgnoreCaseOrderByNameAsc("test"))
                .thenReturn(List.of(cat1));

        List<CategoryDto.CategoryResponse> result = categoryService.search("test");

        assertEquals(1, result.size());
        assertEquals("Test Design", result.get(0).name());
    }

    @Test
    void search_emptyQuery_returnsAll() {
        KbCategoryEntity cat1 = new KbCategoryEntity(1L, "Testing", now);
        when(categoryRepository.findAll()).thenReturn(List.of(cat1));

        List<CategoryDto.CategoryResponse> result = categoryService.search("");

        assertEquals(1, result.size());
    }

    @Test
    void create_savesNewCategory() {
        KbCategoryEntity saved = new KbCategoryEntity(1L, "NewCategory", now);
        when(categoryRepository.existsByName("NewCategory")).thenReturn(false);
        when(categoryRepository.save(any())).thenReturn(saved);

        CategoryDto.CategoryResponse result = categoryService.create("NewCategory");

        assertEquals("NewCategory", result.name());
        verify(categoryRepository).save(any());
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
}
