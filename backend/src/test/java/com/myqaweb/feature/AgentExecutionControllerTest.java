package com.myqaweb.feature;

import com.myqaweb.common.GlobalExceptionHandler;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for AgentExecutionController — live view frame endpoints (registry_v26).
 */
@WebMvcTest(AgentExecutionController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class AgentExecutionControllerTest {

    private static final byte[] PNG_BYTES = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AgentExecutionService agentExecutionService;

    // --- PUT /api/agent-executions/{id}/frame ---

    @Test
    void putFrame_png_running_returnsNoContent() throws Exception {
        when(agentExecutionService.storeFrame(eq(1L), any(byte[].class), anyString())).thenReturn(true);

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isNoContent());

        verify(agentExecutionService).storeFrame(1L, PNG_BYTES, MediaType.IMAGE_PNG_VALUE);
    }

    @Test
    void putFrame_jpeg_running_returnsNoContent() throws Exception {
        when(agentExecutionService.storeFrame(eq(1L), any(byte[].class), anyString())).thenReturn(true);

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(new byte[] {(byte) 0xFF, (byte) 0xD8}))
                .andExpect(status().isNoContent());

        verify(agentExecutionService).storeFrame(eq(1L), any(byte[].class), eq(MediaType.IMAGE_JPEG_VALUE));
    }

    @Test
    void putFrame_notRunning_returnsConflict() throws Exception {
        when(agentExecutionService.storeFrame(eq(1L), any(byte[].class), anyString())).thenReturn(false);

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isConflict());
    }

    @Test
    void putFrame_overMaxSize_returnsContentTooLarge() throws Exception {
        byte[] tooLarge = new byte[AgentExecutionController.MAX_FRAME_BYTES + 1];

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 1L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(tooLarge))
                .andExpect(status().is(413));

        verify(agentExecutionService, never()).storeFrame(anyLong(), any(), any());
    }

    @Test
    void putFrame_unknownJob_returnsNotFound() throws Exception {
        when(agentExecutionService.storeFrame(eq(999L), any(byte[].class), anyString()))
                .thenThrow(new EntityNotFoundException("AgentExecution job not found: 999"));

        mockMvc.perform(put("/api/agent-executions/{id}/frame", 999L)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }

    // --- GET /api/agent-executions/{id}/frame ---

    @Test
    void getFrame_exists_returnsBytesWithContentTypeAndNoStore() throws Exception {
        when(agentExecutionService.getFrame(1L))
                .thenReturn(Optional.of(new AgentLiveFrameStore.Frame(PNG_BYTES, MediaType.IMAGE_PNG_VALUE)));

        mockMvc.perform(get("/api/agent-executions/{id}/frame", 1L))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(PNG_BYTES))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void getFrame_none_returnsNoContent() throws Exception {
        when(agentExecutionService.getFrame(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/agent-executions/{id}/frame", 1L))
                .andExpect(status().isNoContent())
                .andExpect(content().bytes(new byte[0]));
    }
}
