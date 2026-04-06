package com.myqaweb.feature;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for SegmentController.
 */
@WebMvcTest(SegmentController.class)
@Import(GlobalExceptionHandler.class)
class SegmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SegmentService segmentService;

    // --- GET /api/segments?productId={id} ---

    @Test
    void listByProduct_returnsOk() throws Exception {
        // Arrange
        List<SegmentDto.SegmentResponse> segments = List.of(
                new SegmentDto.SegmentResponse(1L, "Login", 10L, null),
                new SegmentDto.SegmentResponse(2L, "Login > OAuth", 10L, 1L)
        );
        when(segmentService.findByProductId(10L)).thenReturn(segments);

        // Act & Assert
        mockMvc.perform(get("/api/segments").param("productId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("Login"))
                .andExpect(jsonPath("$.data[1].parentId").value(1));

        verify(segmentService).findByProductId(10L);
    }

    // --- POST /api/segments ---

    @Test
    void create_returns201() throws Exception {
        // Arrange
        SegmentDto.SegmentResponse created = new SegmentDto.SegmentResponse(1L, "Login", 10L, null);
        when(segmentService.create(any(SegmentDto.SegmentRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/segments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"productId": 10, "name": "Login"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("Login"))
                .andExpect(jsonPath("$.data.productId").value(10));

        verify(segmentService).create(any(SegmentDto.SegmentRequest.class));
    }

    @Test
    void createChild_returns201() throws Exception {
        // Arrange
        SegmentDto.SegmentResponse created = new SegmentDto.SegmentResponse(2L, "OAuth", 10L, 1L);
        when(segmentService.create(any(SegmentDto.SegmentRequest.class))).thenReturn(created);

        // Act & Assert
        mockMvc.perform(post("/api/segments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"productId": 10, "name": "OAuth", "parentId": 1}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("OAuth"))
                .andExpect(jsonPath("$.data.parentId").value(1));
    }

    // --- PUT /api/segments/{id} ---

    @Test
    void update_returnsOk() throws Exception {
        // Arrange
        SegmentDto.SegmentResponse updated = new SegmentDto.SegmentResponse(1L, "Login Updated", 10L, null);
        when(segmentService.update(eq(1L), eq("Login Updated"))).thenReturn(updated);

        // Act & Assert
        mockMvc.perform(put("/api/segments/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"productId": 10, "name": "Login Updated"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("Login Updated"));

        verify(segmentService).update(eq(1L), eq("Login Updated"));
    }

    @Test
    void update_returns404WhenNotFound() throws Exception {
        // Arrange
        when(segmentService.update(eq(99L), any()))
                .thenThrow(new IllegalArgumentException("Segment not found: 99"));

        // Act & Assert
        mockMvc.perform(put("/api/segments/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"productId": 10, "name": "Nope"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- DELETE /api/segments/{id} ---

    @Test
    void delete_returnsOk() throws Exception {
        // Arrange
        doNothing().when(segmentService).delete(1L);

        // Act & Assert
        mockMvc.perform(delete("/api/segments/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(segmentService).delete(1L);
    }

    @Test
    void delete_returns404WhenNotFound() throws Exception {
        // Arrange
        doThrow(new IllegalArgumentException("Segment not found: 99"))
                .when(segmentService).delete(99L);

        // Act & Assert
        mockMvc.perform(delete("/api/segments/99"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- PATCH /api/segments/{id}/parent ---

    @Test
    void reparent_returnsOk() throws Exception {
        // Arrange
        SegmentDto.SegmentResponse reparented = new SegmentDto.SegmentResponse(1L, "Login", 10L, 3L);
        when(segmentService.reparent(eq(1L), eq(3L))).thenReturn(reparented);

        // Act & Assert
        mockMvc.perform(patch("/api/segments/1/parent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"parentId": 3}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.parentId").value(3));

        verify(segmentService).reparent(eq(1L), eq(3L));
    }

    @Test
    void reparent_toNull_returnsOk() throws Exception {
        // Arrange
        SegmentDto.SegmentResponse reparented = new SegmentDto.SegmentResponse(2L, "Login", 10L, null);
        when(segmentService.reparent(eq(2L), isNull())).thenReturn(reparented);

        // Act & Assert
        mockMvc.perform(patch("/api/segments/2/parent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"parentId": null}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.parentId").isEmpty());

        verify(segmentService).reparent(eq(2L), isNull());
    }

    @Test
    void reparent_returns404WhenNotFound() throws Exception {
        // Arrange
        when(segmentService.reparent(eq(99L), eq(1L)))
                .thenThrow(new IllegalArgumentException("Segment not found: 99"));

        // Act & Assert
        mockMvc.perform(patch("/api/segments/99/parent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"parentId": 1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- Circular Reference Tests ---

    @Test
    void reparent_returns400WhenSelfAsParent() throws Exception {
        // Arrange
        when(segmentService.reparent(eq(1L), eq(1L)))
                .thenThrow(new IllegalArgumentException("Cannot set a segment as its own parent"));

        // Act & Assert
        mockMvc.perform(patch("/api/segments/1/parent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"parentId": 1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Cannot set a segment as its own parent"));
    }

    @Test
    void reparent_returns400WhenCircularReference() throws Exception {
        // Arrange
        when(segmentService.reparent(eq(1L), eq(2L)))
                .thenThrow(new IllegalArgumentException("Cannot set a descendant segment as parent (circular reference)"));

        // Act & Assert
        mockMvc.perform(patch("/api/segments/1/parent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"parentId": 2}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Cannot set a descendant segment as parent (circular reference)"));
    }
}
