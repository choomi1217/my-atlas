package com.myqaweb.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

/**
 * Local filesystem image storage for development environments without S3 credentials.
 * Images are stored under ./uploads/images/{folder}/ and served via /images/** resource handler.
 */
public class LocalImageService implements ImageService {

    private static final Logger log = LoggerFactory.getLogger(LocalImageService.class);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    private final Path uploadRoot;

    public LocalImageService(Path uploadRoot) {
        this.uploadRoot = uploadRoot;
        try {
            Files.createDirectories(uploadRoot);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create upload directory: " + uploadRoot, e);
        }
        log.info("LocalImageService initialized — uploads stored at: {}", uploadRoot.toAbsolutePath());
    }

    @Override
    public String upload(String folder, MultipartFile file) {
        validateFile(file);

        String extension = getExtension(file.getOriginalFilename());
        String filename = UUID.randomUUID() + "." + extension.toLowerCase();
        Path folderPath = uploadRoot.resolve(folder);
        Path filePath = folderPath.resolve(filename);

        try {
            Files.createDirectories(folderPath);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            String storedPath = "/images/" + folder + "/" + filename;
            log.info("Image saved locally: {}", storedPath);
            return storedPath;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save image locally: " + filePath, e);
        }
    }

    @Override
    public void delete(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) return;

        // "/images/convention/uuid.png" → "convention/uuid.png"
        String relative = imagePath.startsWith("/images/") ? imagePath.substring(8) : imagePath;
        Path filePath = uploadRoot.resolve(relative);

        try {
            Files.deleteIfExists(filePath);
            log.info("Image deleted locally: {}", filePath);
        } catch (IOException e) {
            log.warn("Failed to delete local image: {}", filePath, e);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어 있습니다.");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new IllegalArgumentException("이미지 크기는 10MB 이하여야 합니다.");
        }
        String extension = getExtension(file.getOriginalFilename());
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new IllegalArgumentException("허용되지 않는 파일 형식입니다. (png, jpg, jpeg, gif, webp)");
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return null;
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}
