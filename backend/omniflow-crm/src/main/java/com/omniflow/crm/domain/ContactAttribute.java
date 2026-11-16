package com.omniflow.crm.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contact_attributes")
@Getter
@Setter
public class ContactAttribute {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    /**
     * Java field is named attributeKey because {@code key} is a reserved HQL token;
     * the database column is still {@code key}.
     */
    @Column(name = "key", nullable = false)
    private String attributeKey;

    @Column(name = "label")
    private String label;

    @Column(name = "data_type", nullable = false)
    private String dataType = "STRING";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (dataType == null || dataType.isBlank()) {
            dataType = "STRING";
        }
    }
}
