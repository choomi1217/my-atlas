package com.myqaweb.teststudio;

import com.myqaweb.common.GlobalExceptionHandler;
import com.myqaweb.feature.Priority;
import com.myqaweb.feature.TestType;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigResponse;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.ProfileResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller slice tests for {@link TestStudioStyleController}.
 */
@WebMvcTest(TestStudioStyleController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class TestStudioStyleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TestStudioStyleService service;

    private ProfileResponse profileResp() {
        return new ProfileResponse(1L, 5L, "결제팀 스타일", 2L, null, null);
    }

    private ExampleResponse exampleResp() {
        return new ExampleResponse(10L, 1L, "[로그인] 성공", "precond",
                List.of(), List.of("ok"), Priority.HIGH, TestType.FUNCTIONAL, 0, null, null);
    }

    // --- 세트 ---

    @Test
    void listProfiles_returnsOk() throws Exception {
        when(service.listProfiles(5L)).thenReturn(List.of(profileResp()));
        mockMvc.perform(get("/api/test-studio/style-profiles").param("companyId", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("결제팀 스타일"))
                .andExpect(jsonPath("$.data[0].exampleCount").value(2));
    }

    @Test
    void listProfiles_missingCompanyId_400() throws Exception {
        mockMvc.perform(get("/api/test-studio/style-profiles"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
        verify(service, never()).listProfiles(any());
    }

    @Test
    void createProfile_returns201() throws Exception {
        when(service.createProfile(any())).thenReturn(profileResp());
        mockMvc.perform(post("/api/test-studio/style-profiles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":5,\"name\":\"결제팀 스타일\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1));
    }

    @Test
    void createProfile_blankName_400() throws Exception {
        mockMvc.perform(post("/api/test-studio/style-profiles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":5,\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
        verify(service, never()).createProfile(any());
    }

    @Test
    void createProfile_serviceIAE_400() throws Exception {
        when(service.createProfile(any()))
                .thenThrow(new IllegalArgumentException("스타일 세트는 Company당 최대 10개까지 만들 수 있습니다"));
        mockMvc.perform(post("/api/test-studio/style-profiles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":5,\"name\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("스타일 세트는 Company당 최대 10개까지 만들 수 있습니다"));
    }

    @Test
    void renameProfile_returns200() throws Exception {
        when(service.renameProfile(eq(1L), any())).thenReturn(profileResp());
        mockMvc.perform(put("/api/test-studio/style-profiles/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"새 이름\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void deleteProfile_returns204() throws Exception {
        doNothing().when(service).deleteProfile(1L);
        mockMvc.perform(delete("/api/test-studio/style-profiles/1"))
                .andExpect(status().isNoContent());
        verify(service).deleteProfile(1L);
    }

    // --- 예시 ---

    @Test
    void listExamples_returnsOk() throws Exception {
        when(service.listExamples(1L)).thenReturn(List.of(exampleResp()));
        mockMvc.perform(get("/api/test-studio/style-profiles/1/examples"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].title").value("[로그인] 성공"));
    }

    @Test
    void addExample_returns201() throws Exception {
        when(service.addExample(eq(1L), any())).thenReturn(exampleResp());
        mockMvc.perform(post("/api/test-studio/style-profiles/1/examples")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"[로그인] 성공\",\"steps\":[{\"order\":1,\"action\":\"a\",\"expected\":\"e\"}],"
                                + "\"expectedResults\":[\"ok\"],\"priority\":\"HIGH\",\"testType\":\"FUNCTIONAL\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(10));
    }

    @Test
    void addExample_blankTitle_400() throws Exception {
        mockMvc.perform(post("/api/test-studio/style-profiles/1/examples")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest());
        verify(service, never()).addExample(any(), any());
    }

    @Test
    void updateExample_returns200() throws Exception {
        when(service.updateExample(eq(10L), any())).thenReturn(exampleResp());
        mockMvc.perform(put("/api/test-studio/style-examples/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"수정\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteExample_returns204() throws Exception {
        doNothing().when(service).deleteExample(10L);
        mockMvc.perform(delete("/api/test-studio/style-examples/10"))
                .andExpect(status().isNoContent());
    }

    // --- config ---

    @Test
    void getConfig_returnsDefault() throws Exception {
        when(service.getConfig(5L)).thenReturn(
                new ConfigResponse(5L, null, StepFormat.ACTION_EXPECTED, DetailLevel.STANDARD, Tone.PLAIN));
        mockMvc.perform(get("/api/test-studio/config").param("companyId", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.selectedProfileId").doesNotExist())
                .andExpect(jsonPath("$.data.stepFormat").value("ACTION_EXPECTED"))
                .andExpect(jsonPath("$.data.tone").value("PLAIN"));
    }

    @Test
    void getConfig_missingCompanyId_400() throws Exception {
        mockMvc.perform(get("/api/test-studio/config"))
                .andExpect(status().isBadRequest());
        verify(service, never()).getConfig(any());
    }

    @Test
    void upsertConfig_returns200() throws Exception {
        when(service.upsertConfig(any())).thenReturn(
                new ConfigResponse(5L, 1L, StepFormat.NARRATIVE, DetailLevel.DETAILED, Tone.FORMAL));
        mockMvc.perform(put("/api/test-studio/config")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":5,\"selectedProfileId\":1,\"stepFormat\":\"NARRATIVE\","
                                + "\"detailLevel\":\"DETAILED\",\"tone\":\"FORMAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.selectedProfileId").value(1))
                .andExpect(jsonPath("$.data.stepFormat").value("NARRATIVE"));
    }

    @Test
    void upsertConfig_serviceIAE_400() throws Exception {
        when(service.upsertConfig(any()))
                .thenThrow(new IllegalArgumentException("선택한 스타일 세트가 해당 Company에 속하지 않습니다"));
        mockMvc.perform(put("/api/test-studio/config")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":5,\"selectedProfileId\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("선택한 스타일 세트가 해당 Company에 속하지 않습니다"));
    }
}
