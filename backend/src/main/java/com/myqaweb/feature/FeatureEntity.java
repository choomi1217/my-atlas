package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.pgvector.PGvector;

import java.time.LocalDateTime;

/**
 * Feature entity representing a feature within a product.
 */
@Entity
@Table(name = "feature")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeatureEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false, length = 500)
    private String path;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "prompt_text", columnDefinition = "TEXT")
    private String promptText;

    @Convert(converter = FloatArrayToVectorConverter.class)
    @Column(columnDefinition = "vector(1536)")
    private float[] embedding;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
