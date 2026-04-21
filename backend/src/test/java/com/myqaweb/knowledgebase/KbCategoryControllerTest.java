package com.myqaweb.knowledgebase;

import com.myqaweb.common.CategoryDto;
import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(KbCategoryController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class KbCategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private KbCategoryService categoryService;

    private final LocalDateTime now = LocalDateTime.of(2026, 4, 10, 10, 0, 0);

    @Test
    void list_returnsAllCategories() throws Exception {
        List<CategoryDto.CategoryResponse> categories = List.of(
                new CategoryDto.CategoryResponse(1L, "Testing", now),
                new CategoryDto.CategoryResponse(2L, "Automation", now)
        );
        when(categoryService.findAll()).thenReturn(categories);

        mockMvc.perform(get("/api/kb/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("Testing"));
    }

    @Test
    void search_returnsFilteredCategories() throws Exception {
        List<CategoryDto.CategoryResponse> categories = List.of(
                new CategoryDto.CategoryResponse(1L, "Test Design", now)
        );
        when(categoryService.search("test")).thenReturn(categories);

        mockMvc.perform(get("/api/kb/categories/search").param("q", "test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("Test Design"));
    }

    @Test
    void create_returns201() throws Exception {
        CategoryDto.CategoryResponse created = new CategoryDto.CategoryResponse(1L, "NewCat", now);
        when(categoryService.create("NewCat")).thenReturn(created);

        mockMvc.perform(post("/api/kb/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "NewCat"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("NewCat"));
    }

    @Test
    void create_returns400WhenNameBlank() throws Exception {
        mockMvc.perform(post("/api/kb/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(categoryService, never()).create(any());
    }
}
