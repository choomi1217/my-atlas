package com.myqaweb.convention;

import com.myqaweb.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for ConventionImageController.
 * Uses a temp directory for file upload/serve operations.
 */
@WebMvcTest(ConventionImageController.class)
@Import(GlobalExceptionHandler.class)
class ConventionImageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @TempDir
    static Path tempDir;

    /**
     * We need to override the upload-dir property. Since @WebMvcTest creates the controller
     * with @Value, we use a static @TempDir and configure via @TestPropertySource.
     * However, @TempDir static fields are initialized before the context.
     * Instead, we use a DynamicPropertySource or configure via test property.
     *
     * Actually, the simplest approach: since @WebMvcTest with @TempDir static won't
     * integrate cleanly with @Value, we'll use @SpringBootTest with a limited scope.
     */

    // Note: The above comment is resolved by using
    // @TestPropertySource in a separate integration-style approach.
    // For @WebMvcTest, we need to provide the property differently.

    // Since ConventionImageController uses @Value for the upload dir,
    // and @WebMvcTest doesn't load full context, we override via properties.
    // However, @TempDir path isn't known at compile time.
    // We handle this by creating a dedicated test that works with the actual controller.

    // --- POST /api/convention-images ---

    @Test
    void upload_validImage_returns201() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "test-image.png", "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47}); // PNG header bytes

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").isString());
    }

    @Test
    void upload_emptyFile_returns400() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.png", "image/png", new byte[0]);

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("파일이 비어 있습니다."));
    }

    @Test
    void upload_oversizedFile_returns400() throws Exception {
        // Arrange: 11MB file (exceeds 10MB limit)
        byte[] oversizedContent = new byte[11 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile(
                "file", "large.png", "image/png", oversizedContent);

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("이미지 크기는 10MB 이하여야 합니다."));
    }

    @Test
    void upload_invalidExtension_returns400() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "document.pdf", "application/pdf",
                new byte[]{0x25, 0x50, 0x44, 0x46}); // PDF header

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
    }

    @Test
    void upload_noExtension_returns400() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "noextension", "application/octet-stream",
                new byte[]{0x01, 0x02});

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void upload_jpegExtension_returns201() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.jpeg", "image/jpeg",
                new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").isString());
    }

    @Test
    void upload_webpExtension_returns201() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "image.webp", "image/webp",
                new byte[]{0x52, 0x49, 0x46, 0x46});

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    // --- GET /api/convention-images/{filename} ---

    @Test
    void serve_nonExistentFile_returns404() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/api/convention-images/nonexistent.png"))
                .andExpect(status().isNotFound());
    }

    @Test
    void upload_gifExtension_returns201() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file", "animation.gif", "image/gif",
                new byte[]{0x47, 0x49, 0x46, 0x38}); // GIF header

        // Act & Assert
        mockMvc.perform(multipart("/api/convention-images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }
}
