package com.myqaweb.feature;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(VersionController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class VersionControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VersionService versionService;

    @Autowired
    private ObjectMapper objectMapper;

    private VersionDto.VersionSummary versionSummary;
    private VersionDto.VersionDetail versionDetail;

    @BeforeEach
    void setUp() {
        VersionDto.ProgressStats progress = new VersionDto.ProgressStats(
                10, 10, 8, 2, 0, 0, 0, 0
        );

        versionSummary = new VersionDto.VersionSummary(
                1L, 1L, "v9", "Release v9", LocalDate.of(2026, 5, 1), null,
                2, progress, false, null, LocalDateTime.now(), LocalDateTime.now()
        );

        VersionDto.VersionPhaseDto phaseDto = new VersionDto.VersionPhaseDto(
                1L, "1차 테스트",
                List.of(new VersionDto.TestRunRef(1L, "1차 테스트", 10)),
                10, 1, progress
        );

        versionDetail = new VersionDto.VersionDetail(
                1L, 1L, "v9", "Release v9", LocalDate.of(2026, 5, 1), null,
                List.of(phaseDto), progress, false, null, LocalDateTime.now(), LocalDateTime.now()
        );
    }

    @Test
    void testGetVersions_Success() throws Exception {
        // Given
        when(versionService.getAllByProductId(1L))
                .thenReturn(List.of(versionSummary));

        // When & Then
        mockMvc.perform(get("/api/products/{productId}/versions", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].name", is("v9")))
                .andExpect(jsonPath("$.data[0].isReleaseDatePassed", is(false)))
                .andExpect(jsonPath("$.data[0].warningMessage", nullValue()));

        verify(versionService).getAllByProductId(1L);
    }

    @Test
    void testGetVersions_WithPassedReleaseDate() throws Exception {
        // Given
        VersionDto.ProgressStats progress = new VersionDto.ProgressStats(
                16, 15, 12, 2, 1, 0, 0, 1
        );

        VersionDto.VersionSummary pastVersion = new VersionDto.VersionSummary(
                2L, 1L, "v8", "Release v8", LocalDate.of(2026, 3, 1), null,
                2, progress, true, "⚠️ 릴리스 예정일(2026-03-01)이 지났습니다. 진행 상황을 확인하세요.",
                LocalDateTime.now(), LocalDateTime.now()
        );

        when(versionService.getAllByProductId(1L))
                .thenReturn(List.of(pastVersion));

        // When & Then
        mockMvc.perform(get("/api/products/{productId}/versions", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data[0].isReleaseDatePassed", is(true)))
                .andExpect(jsonPath("$.data[0].warningMessage", notNullValue()));

        verify(versionService).getAllByProductId(1L);
    }

    @Test
    void testGetVersion_Success() throws Exception {
        // Given
        when(versionService.getById(1L)).thenReturn(versionDetail);

        // When & Then
        mockMvc.perform(get("/api/versions/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.id", is(1)))
                .andExpect(jsonPath("$.data.name", is("v9")))
                .andExpect(jsonPath("$.data.phases", hasSize(1)))
                .andExpect(jsonPath("$.data.totalProgress.total", is(10)))
                .andExpect(jsonPath("$.data.totalProgress.pass", is(8)));

        verify(versionService).getById(1L);
    }

    @Test
    void testCreateVersion_Success() throws Exception {
        // Given
        VersionDto.PhaseRequest phaseRequest = new VersionDto.PhaseRequest("1차 테스트", List.of(1L));
        VersionDto.CreateVersionRequest request = new VersionDto.CreateVersionRequest(
                1L, "v9", "Release v9", LocalDate.of(2026, 5, 1), List.of(phaseRequest)
        );

        when(versionService.create(any())).thenReturn(versionDetail);

        // When & Then
        mockMvc.perform(post("/api/products/{productId}/versions", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.name", is("v9")))
                .andExpect(jsonPath("$.data.phases", hasSize(1)));

        verify(versionService).create(any());
    }

    @Test
    void testCreateVersion_ValidationFails_MissingName() throws Exception {
        // Given
        VersionDto.PhaseRequest phaseRequest = new VersionDto.PhaseRequest("1차 테스트", List.of(1L));
        VersionDto.CreateVersionRequest request = new VersionDto.CreateVersionRequest(
                1L, "", "Release v9", LocalDate.of(2026, 5, 1), List.of(phaseRequest)
        );

        // When & Then
        mockMvc.perform(post("/api/products/{productId}/versions", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(versionService, never()).create(any());
    }

    @Test
    void testCreateVersion_ValidationFails_EmptyPhases() throws Exception {
        // Given
        VersionDto.CreateVersionRequest request = new VersionDto.CreateVersionRequest(
                1L, "v9", "Release v9", LocalDate.of(2026, 5, 1), List.of()
        );

        // When & Then
        mockMvc.perform(post("/api/products/{productId}/versions", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(versionService, never()).create(any());
    }

    @Test
    void testUpdateVersion_Success() throws Exception {
        // Given
        VersionDto.UpdateVersionRequest request = new VersionDto.UpdateVersionRequest(
                "v9-updated", null, LocalDate.of(2026, 5, 15)
        );

        VersionDto.VersionPhaseDto phaseDto = new VersionDto.VersionPhaseDto(
                1L, "1차 테스트",
                List.of(new VersionDto.TestRunRef(1L, "1차 테스트", 10)),
                10, 1,
                new VersionDto.ProgressStats(10, 10, 8, 2, 0, 0, 0, 0)
        );

        VersionDto.VersionDetail updated = new VersionDto.VersionDetail(
                1L, 1L, "v9-updated", "Release v9", LocalDate.of(2026, 5, 15), null,
                List.of(phaseDto),
                new VersionDto.ProgressStats(10, 10, 8, 2, 0, 0, 0, 0),
                false, null, LocalDateTime.now(), LocalDateTime.now()
        );

        when(versionService.update(eq(1L), any())).thenReturn(updated);

        // When & Then
        mockMvc.perform(patch("/api/versions/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.name", is("v9-updated")));

        verify(versionService).update(eq(1L), any());
    }

    @Test
    void testUpdateVersion_ReleaseDateChangeable_AfterPassing() throws Exception {
        // Given - version with past release date, updating to new date
        VersionDto.UpdateVersionRequest request = new VersionDto.UpdateVersionRequest(
                null, null, LocalDate.of(2026, 6, 1)
        );

        VersionDto.VersionDetail updated = new VersionDto.VersionDetail(
                1L, 1L, "v8", "Release v8", LocalDate.of(2026, 6, 1), null,
                List.of(),
                new VersionDto.ProgressStats(0, 0, 0, 0, 0, 0, 0, 0),
                false, null, LocalDateTime.now(), LocalDateTime.now()
        );

        when(versionService.update(eq(1L), any())).thenReturn(updated);

        // When & Then - Should succeed even if originally past date
        mockMvc.perform(patch("/api/versions/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.releaseDate", is("2026-06-01")));

        verify(versionService).update(eq(1L), any());
    }

    @Test
    void testCopyVersion_Success() throws Exception {
        // Given
        VersionDto.VersionCopyRequest request = new VersionDto.VersionCopyRequest(
                "v9-延期", LocalDate.of(2026, 5, 15)
        );

        VersionDto.VersionPhaseDto phaseDto = new VersionDto.VersionPhaseDto(
                1L, "1차 테스트",
                List.of(new VersionDto.TestRunRef(1L, "1차 테스트", 10)),
                10, 1,
                new VersionDto.ProgressStats(10, 0, 0, 0, 0, 0, 0, 10)
        );

        VersionDto.VersionDetail copied = new VersionDto.VersionDetail(
                2L, 1L, "v9-延期", "Release v9", LocalDate.of(2026, 5, 15), 1L,
                List.of(phaseDto),
                new VersionDto.ProgressStats(10, 0, 0, 0, 0, 0, 0, 10),
                false, null, LocalDateTime.now(), LocalDateTime.now()
        );

        when(versionService.copy(eq(1L), any())).thenReturn(copied);

        // When & Then
        mockMvc.perform(post("/api/versions/{id}/copy", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.name", is("v9-延期")))
                .andExpect(jsonPath("$.data.copiedFrom", is(1)));

        verify(versionService).copy(eq(1L), any());
    }

    @Test
    void testDeleteVersion_Success() throws Exception {
        // Given
        doNothing().when(versionService).delete(1L);

        // When & Then
        mockMvc.perform(delete("/api/versions/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        verify(versionService).delete(1L);
    }
}
