package com.myqaweb.common;

import org.springframework.web.multipart.MultipartFile;

/**
 * Image upload/delete abstraction.
 * S3ImageService (AWS) or LocalImageService (local dev) is selected at startup.
 */
public interface ImageService {

    /**
     * Upload image.
     * @param folder subfolder name (e.g. "convention", "feature", "kb")
     * @param file multipart file
     * @return stored path (e.g. "/images/convention/uuid.png")
     */
    String upload(String folder, MultipartFile file);

    /**
     * Delete image.
     * @param imagePath path stored in DB (e.g. "/images/convention/uuid.png")
     */
    void delete(String imagePath);
}
