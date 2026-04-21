package com.myqaweb.knowledgebase;

import com.myqaweb.common.ImageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(KbImageController.class)
@AutoConfigureMockMvc(addFilters = false)
class KbImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ImageService s3ImageService;

    @Test
    void uploadImage_withValidPng_returns201WithUrl() throws Exception {
        when(s3ImageService.upload(eq("kb"), any()))
                .thenReturn("/images/kb/test-uuid.png");

        MockMultipartFile file = new MockMultipartFile(
                "file", "test-image.png", "image/png", "fake-png-content".getBytes());

        mockMvc.perform(multipart("/api/kb/images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").value("/images/kb/test-uuid.png"));
    }

    @Test
    void uploadImage_withEmptyFile_returns400() throws Exception {
        when(s3ImageService.upload(eq("kb"), any()))
                .thenThrow(new IllegalArgumentException("파일이 비어 있습니다."));

        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.png", "image/png", new byte[0]);

        mockMvc.perform(multipart("/api/kb/images").file(emptyFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("파일이 비어 있습니다."));
    }

    @Test
    void uploadImage_withDisallowedExtension_returns400() throws Exception {
        when(s3ImageService.upload(eq("kb"), any()))
                .thenThrow(new IllegalArgumentException("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));

        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malware.exe", "application/octet-stream", "not-an-image".getBytes());

        mockMvc.perform(multipart("/api/kb/images").file(exeFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
    }

    @Test
    void uploadImage_withOversizedFile_returns400() throws Exception {
        when(s3ImageService.upload(eq("kb"), any()))
                .thenThrow(new IllegalArgumentException("이미지 크기는 10MB 이하여야 합니다."));

        byte[] largeContent = new byte[10 * 1024 * 1024 + 1];
        MockMultipartFile largeFile = new MockMultipartFile(
                "file", "large-image.png", "image/png", largeContent);

        mockMvc.perform(multipart("/api/kb/images").file(largeFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("이미지 크기는 10MB 이하여야 합니다."));
    }
}
