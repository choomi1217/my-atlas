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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for ProductController.
 */
@WebMvcTest(ProductController.class)
@Import(GlobalExceptionHandler.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductService productService;

    private final LocalDateTime now = LocalDateTime.of(2026, 3, 26, 10, 0, 0);

    // --- GET /api/products?companyId={id} ---

    @Test
    void listByCompany_returnsOk() throws Exception {
        // Arrange
        List<ProductDto.ProductResponse> products = List.of(
                new ProductDto.ProductResponse(1L, 10L, "Web App", Platform.WEB, "Main app", now),
                new ProductDto.ProductResponse(2L, 10L, "Mobile App", Platform.MOBILE, null, now)
        );
        when(productService.findByCompanyId(10L)).thenReturn(products);

        // Act & Assert
        mockMvc.perform(get("/api/products").param("companyId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("Web App"))
                .andExpect(jsonPath("$.data[0].platform").value("WEB"));

        verify(productService).findByCompanyId(10L);
    }

    // --- POST /api/products ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        ProductDto.ProductResponse created = new ProductDto.ProductResponse(
                1L, 10L, "New Product", Platform.WEB, "A web product", now);
        when(productService.save(any(ProductDto.ProductRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": 10, "name": "New Product", "platform": "WEB", "description": "A web product"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("New Product"))
                .andExpect(jsonPath("$.data.platform").value("WEB"));

        verify(productService).save(any(ProductDto.ProductRequest.class));
    }

    @Test
    void create_returns400WhenNameBlank() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": 10, "name": "", "platform": "WEB"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(productService, never()).save(any());
    }

    // --- PUT /api/products/{id} ---

    @Test
    void update_returnsOk() throws Exception {
        // Arrange
        ProductDto.ProductResponse updated = new ProductDto.ProductResponse(
                1L, 10L, "Updated Product", Platform.DESKTOP, "Updated desc", now);
        when(productService.update(eq(1L), any(ProductDto.ProductRequest.class))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/products/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": 10, "name": "Updated Product", "platform": "DESKTOP", "description": "Updated desc"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("Updated Product"));

        verify(productService).update(eq(1L), any(ProductDto.ProductRequest.class));
    }

    @Test
    void update_returns404WhenNotFound() throws Exception {
        // Arrange
        when(productService.update(eq(99L), any(ProductDto.ProductRequest.class)))
                .thenThrow(new IllegalArgumentException("Product not found: 99"));

        // Act & Assert
        mockMvc.perform(put("/api/products/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": 10, "name": "Name", "platform": "WEB"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- DELETE /api/products/{id} ---

    @Test
    void delete_returnsOk() throws Exception {
        // Arrange
        doNothing().when(productService).delete(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/products/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(productService).delete(1L);
    }
}
