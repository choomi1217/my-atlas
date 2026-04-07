package com.myqaweb.feature;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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

/**
 * Controller tests for CompanyController.
 */
@WebMvcTest(CompanyController.class)
@Import(GlobalExceptionHandler.class)
class CompanyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CompanyService companyService;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 26, 10, 0, 0);

    // --- GET /api/companies ---

    @Test
    void list_returnsOk() throws Exception {
        // Arrange
        List<CompanyDto.CompanyResponse> companies = List.of(
                new CompanyDto.CompanyResponse(1L, "Corp A", true, now),
                new CompanyDto.CompanyResponse(2L, "Corp B", false, now)
        );
        when(companyService.findAll()).thenReturn(companies);

        // Act & Assert
        mockMvc.perform(get("/api/companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("Corp A"));

        verify(companyService).findAll();
    }

    // --- POST /api/companies ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        CompanyDto.CompanyResponse created = new CompanyDto.CompanyResponse(1L, "New Corp", false, now);
        when(companyService.save(any(CompanyDto.CompanyRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "New Corp"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("New Corp"))
                .andExpect(jsonPath("$.data.isActive").value(false));

        verify(companyService).save(any(CompanyDto.CompanyRequest.class));
    }

    @Test
    void create_returns400WhenNameBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(companyService, never()).save(any());
    }

    // --- PATCH /api/companies/{id}/activate ---

    @Test
    void activate_returnsOk() throws Exception {
        // Arrange
        CompanyDto.CompanyResponse activated = new CompanyDto.CompanyResponse(1L, "Corp A", true, now);
        when(companyService.setActive(1L)).thenReturn(activated);

        // Act & Assert
        mockMvc.perform(patch("/api/companies/1/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isActive").value(true));

        verify(companyService).setActive(1L);
    }

    @Test
    void activate_returns404WhenNotFound() throws Exception {
        // Arrange
        when(companyService.setActive(99L))
                .thenThrow(new IllegalArgumentException("Company not found: 99"));

        // Act & Assert
        mockMvc.perform(patch("/api/companies/99/activate"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- DELETE /api/companies/{id} ---

    @Test
    void delete_returnsOk() throws Exception {
        // Arrange
        doNothing().when(companyService).delete(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/companies/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(companyService).delete(1L);
    }

    @Test
    void delete_returns404WhenNotFound() throws Exception {
        // Arrange
        doThrow(new IllegalArgumentException("Company not found: 99"))
                .when(companyService).delete(99L);

        // Act & Assert
        mockMvc.perform(delete("/api/companies/99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
