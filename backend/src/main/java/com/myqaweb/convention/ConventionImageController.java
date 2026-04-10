package com.myqaweb.convention;

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

@RestController
@RequestMapping("/api/convention-images")
public class ConventionImageController {

    private static final Logger log = LoggerFactory.getLogger(ConventionImageController.class);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    private final Path uploadDir;

    public ConventionImageController(@Value("${convention.image.upload-dir:convention-images}") String uploadDirPath) {
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create image upload directory: " + uploadDirPath, e);
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("파일이 비어 있습니다."));
        }

        if (file.getSize() > MAX_IMAGE_SIZE) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("이미지 크기는 10MB 이하여야 합니다."));
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)"));
        }

        String filename = UUID.randomUUID() + "." + extension.toLowerCase();
        try {
            Path targetPath = uploadDir.resolve(filename);
            file.transferTo(targetPath.toFile());
            String imageUrl = "/api/convention-images/" + filename;
            log.info("Convention image uploaded: {}", filename);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok(Map.of("url", imageUrl)));
        } catch (IOException e) {
            log.error("Failed to save convention image: {}", filename, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("이미지 저장에 실패했습니다."));
        }
    }

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
