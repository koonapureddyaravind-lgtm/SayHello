package com.omniflow.integration.entity;

import com.omniflow.common.domain.BaseEntity;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ProviderAccountStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * A configured outbound provider (SMTP, SES, Meta Cloud API, Twilio, ...).
 * Credential values are stored encrypted as a JSON object in {@code encrypted_credentials}.
 */
@Entity
@Table(name = "provider_accounts")
@Getter
@Setter
public class ProviderAccount extends BaseEntity {

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private Channel channel;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProviderAccountStatus status = ProviderAccountStatus.ACTIVE;

    @Column(name = "encrypted_credentials")
    private String encryptedCredentials;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", nullable = false)
    private Map<String, Object> config = Map.of();

    @Column(name = "from_address")
    private String fromAddress;

    @Column(name = "from_name")
    private String fromName;

    @Column(name = "webhook_secret")
    private String webhookSecret;

    @Column(name = "is_default", nullable = false)
    private boolean defaultAccount;

    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;
}
