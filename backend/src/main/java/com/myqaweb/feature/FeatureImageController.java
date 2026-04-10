package com.myqaweb.feature;

import com.myqaweb.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Shared image upload/serve controller for Feature Registry domain.
 * Used by TestCase images and TestResult comment images.
 */
@RestController
@RequestMapping("/api/feature-images")
public class FeatureImageController {

    private static final Logger log = LoggerFactory.getLogger(FeatureImageController.class);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    private final Path uploadDir;

    public FeatureImageController(@Value("${feature.image.upload-dir:feature-images}") String uploadDirPath) {
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create feature image upload directory: " + uploadDirPath, e);
        }
    }

    /**
     * POST /api/feature-images — Upload an image.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File is empty."));
        }

        if (file.getSize() > MAX_IMAGE_SIZE) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Image size must be 10MB or less."));
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Unsupported file type. (png, jpg, jpeg, gif, webp)"));
        }

        String filename = UUID.randomUUID() + "." + extension.toLowerCase();
        try {
            Path targetPath = uploadDir.resolve(filename);
            file.transferTo(targetPath.toFile());
            String imageUrl = "/api/feature-images/" + filename;
            log.info("Feature image uploaded: {} (original: {})", filename, originalFilename);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok(Map.of(
                            "url", imageUrl,
                            "filename", filename,
                            "originalName", originalFilename != null ? originalFilename : filename
                    )));
        } catch (IOException e) {
            log.error("Failed to save feature image: {}", filename, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to save image."));
        }
    }

    /**
     * GET /api/feature-images/{filename} — Serve an image.
     */
    @GetMapping("/{filename}")
    public ResponseEntity<Resource> serveImage(@PathVariable String filename) {
        try {
            Path filePath = uploadDir.resolve(filename).normalize();
            if (!filePath.startsWith(uploadDir)) {
                return ResponseEntity.badRequest().build();
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return null;
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}
