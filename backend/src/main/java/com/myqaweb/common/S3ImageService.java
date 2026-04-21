package com.myqaweb.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

public class S3ImageService implements ImageService {

    private static final Logger log = LoggerFactory.getLogger(S3ImageService.class);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    private final S3Client s3Client;
    private final String bucketName;

    public S3ImageService(S3Client s3Client, String bucketName) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
    }

    /**
     * Upload image to S3.
     * @param folder subfolder name (e.g. "convention", "feature", "kb")
     * @param file multipart file
     * @return public path for CloudFront (e.g. "/images/convention/uuid.png")
     */
    public String upload(String folder, MultipartFile file) {
        validateFile(file);

        String extension = getExtension(file.getOriginalFilename());
        String filename = UUID.randomUUID() + "." + extension.toLowerCase();
        String s3Key = "images/" + folder + "/" + filename;

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            log.info("Image uploaded to S3: {}", s3Key);
            return "/" + s3Key;
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload image to S3: " + s3Key, e);
        }
    }

    /**
     * Delete image from S3.
     * @param imagePath path stored in DB (e.g. "/images/convention/uuid.png")
     */
    public void delete(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) return;

        String s3Key = imagePath.startsWith("/") ? imagePath.substring(1) : imagePath;

        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Key)
                    .build());
            log.info("Image deleted from S3: {}", s3Key);
        } catch (Exception e) {
            log.warn("Failed to delete image from S3: {}", s3Key, e);
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
