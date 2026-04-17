package com.myqaweb.convention;

import com.myqaweb.common.GlobalExceptionHandler;
import com.myqaweb.common.S3ImageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ConventionImageController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class ConventionImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private S3ImageService s3ImageService;

    @Test
    void upload_validImage_returns201() throws Exception {
        when(s3ImageService.upload(eq("convention"), any()))
                .thenReturn("/images/convention/test-uuid.png");

        MockMultipartFile file = new MockMultipartFile(
                "file", "test-image.png", "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47});

        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").value("/images/convention/test-uuid.png"));
    }

    @Test
    void upload_emptyFile_returns400() throws Exception {
        when(s3ImageService.upload(eq("convention"), any()))
                .thenThrow(new IllegalArgumentException("파일이 비어 있습니다."));

        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.png", "image/png", new byte[0]);

        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("파일이 비어 있습니다."));
    }

    @Test
    void upload_oversizedFile_returns400() throws Exception {
        when(s3ImageService.upload(eq("convention"), any()))
                .thenThrow(new IllegalArgumentException("이미지 크기는 10MB 이하여야 합니다."));

        byte[] oversizedContent = new byte[11 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile(
                "file", "large.png", "image/png", oversizedContent);

        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("이미지 크기는 10MB 이하여야 합니다."));
    }

    @Test
    void upload_invalidExtension_returns400() throws Exception {
        when(s3ImageService.upload(eq("convention"), any()))
                .thenThrow(new IllegalArgumentException("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "document.pdf", "application/pdf",
                new byte[]{0x25, 0x50, 0x44, 0x46});

        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
    }
}
