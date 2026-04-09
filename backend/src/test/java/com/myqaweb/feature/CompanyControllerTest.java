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

import static org.mockito.ArgumentMatchers.*;
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
                new CompanyDto.CompanyResponse(1L, "Corp A", true, 3, now),
                new CompanyDto.CompanyResponse(2L, "Corp B", false, 1, now)
        );
        when(companyService.findAll()).thenReturn(companies);

        // Act & Assert
        mockMvc.perform(get("/api/companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("Corp A"))
                .andExpect(jsonPath("$.data[0].productCount").value(3));

        verify(companyService).findAll();
    }

    // --- POST /api/companies ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        CompanyDto.CompanyResponse created = new CompanyDto.CompanyResponse(1L, "New Corp", false, 0, now);
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
        CompanyDto.CompanyResponse activated = new CompanyDto.CompanyResponse(1L, "Corp A", true, 2, now);
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

    // --- PUT /api/companies/{id} ---

    @Test
    void update_returnsOk() throws Exception {
        // Arrange
        CompanyDto.CompanyResponse updated = new CompanyDto.CompanyResponse(1L, "Updated Corp", true, 2, now);
        when(companyService.update(eq(1L), any(CompanyDto.CompanyRequest.class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/companies/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Updated Corp"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("Updated Corp"))
                .andExpect(jsonPath("$.data.productCount").value(2));

        verify(companyService).update(eq(1L), any(CompanyDto.CompanyRequest.class));
    }

    @Test
    void update_returns400WhenNotFound() throws Exception {
        // Arrange
        when(companyService.update(eq(99L), any(CompanyDto.CompanyRequest.class)))
                .thenThrow(new IllegalArgumentException("Company not found: 99"));

        // Act & Assert
        mockMvc.perform(put("/api/companies/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Updated Corp"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void update_returns400WhenNameBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(put("/api/companies/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(companyService, never()).update(anyLong(), any());
    }

    // --- PATCH /api/companies/{id}/deactivate ---

    @Test
    void deactivate_returnsOk() throws Exception {
        // Arrange
        CompanyDto.CompanyResponse deactivated = new CompanyDto.CompanyResponse(1L, "Corp A", false, 2, now);
        when(companyService.deactivate(1L)).thenReturn(deactivated);

        // Act & Assert
        mockMvc.perform(patch("/api/companies/1/deactivate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.isActive").value(false));

        verify(companyService).deactivate(1L);
    }

    @Test
    void deactivate_returns400WhenNotFound() throws Exception {
        // Arrange
        when(companyService.deactivate(99L))
                .thenThrow(new IllegalArgumentException("Company not found: 99"));

        // Act & Assert
        mockMvc.perform(patch("/api/companies/99/deactivate"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
