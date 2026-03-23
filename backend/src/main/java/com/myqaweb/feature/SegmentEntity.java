package com.myqaweb.feature;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Segment entity representing a hierarchical path node within a product.
 * Uses Adjacency List pattern (parent_id self-reference).
 */
@Entity
@Table(name = "segment")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SegmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private SegmentEntity parent;
}
