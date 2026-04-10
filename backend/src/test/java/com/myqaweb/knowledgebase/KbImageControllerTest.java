package com.myqaweb.knowledgebase;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for KbImageController.
 * Uses a temporary directory for image uploads to avoid file system side effects.
 */
@WebMvcTest(KbImageController.class)
@TestPropertySource(properties = "kb.image.upload-dir=${java.io.tmpdir}/kb-image-test-${random.uuid}")
@AutoConfigureMockMvc(addFilters = false)
class KbImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // --- POST /api/kb/images ---

    @Test
    void uploadImage_withValidPng_returns201WithUrl() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "test-image.png", "image/png", "fake-png-content".getBytes());

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").isString())
                .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.startsWith("/api/kb/images/")))
                .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.endsWith(".png")));
    }

    @Test
    void uploadImage_withValidJpeg_returns201() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.jpeg", "image/jpeg", "fake-jpeg-content".getBytes());

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.endsWith(".jpeg")));
    }

    @Test
    void uploadImage_withValidWebp_returns201() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "image.webp", "image/webp", "fake-webp-content".getBytes());

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.endsWith(".webp")));
    }

    @Test
    void uploadImage_withEmptyFile_returns400() throws Exception {
        // Arrange
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.png", "image/png", new byte[0]);

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(emptyFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("파일이 비어 있습니다."));
    }

    @Test
    void uploadImage_withDisallowedExtension_returns400() throws Exception {
        // Arrange
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malware.exe", "application/octet-stream", "not-an-image".getBytes());

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(exeFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
    }

    @Test
    void uploadImage_withTxtExtension_returns400() throws Exception {
        // Arrange
        MockMultipartFile txtFile = new MockMultipartFile(
                "file", "notes.txt", "text/plain", "some text".getBytes());

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(txtFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
    }

    @Test
    void uploadImage_withNoExtension_returns400() throws Exception {
        // Arrange
        MockMultipartFile noExtFile = new MockMultipartFile(
                "file", "noextension", "application/octet-stream", "some content".getBytes());

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(noExtFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
    }

    @Test
    void uploadImage_withOversizedFile_returns400() throws Exception {
        // Arrange: create a file larger than 10MB
        byte[] largeContent = new byte[10 * 1024 * 1024 + 1];
        MockMultipartFile largeFile = new MockMultipartFile(
                "file", "large-image.png", "image/png", largeContent);

        // Act & Assert
        mockMvc.perform(multipart("/api/kb/images").file(largeFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("이미지 크기는 10MB 이하여야 합니다."));
    }

    // --- GET /api/kb/images/{filename} ---

    @Test
    void serveImage_existingFile_returns200() throws Exception {
        // Arrange: first upload an image, then retrieve it
        MockMultipartFile file = new MockMultipartFile(
                "file", "serve-test.png", "image/png", "png-content-for-serve".getBytes());

        String responseBody = mockMvc.perform(multipart("/api/kb/images").file(file))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        // Extract the filename from the URL in the response
        // Response format: {"success":true,"message":"OK","data":{"url":"/api/kb/images/<uuid>.png"}}
        String url = com.jayway.jsonpath.JsonPath.read(responseBody, "$.data.url");
        String filename = url.substring(url.lastIndexOf('/') + 1);

        // Act & Assert
        mockMvc.perform(get("/api/kb/images/" + filename))
                .andExpect(status().isOk());
    }

    @Test
    void serveImage_nonExistentFile_returns404() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/api/kb/images/non-existent-file.png"))
                .andExpect(status().isNotFound());
    }
}
