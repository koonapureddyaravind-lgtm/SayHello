package com.omniflow.billing.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.omniflow.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "plans")
@Getter
@Setter
public class Plan extends BaseEntity {

    @Column(name = "code", nullable = false)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "price_monthly_cents", nullable = false)
    private int priceMonthlyCents;

    @Column(name = "currency", nullable = false)
    private String currency = "USD";

    @Column(name = "included_emails", nullable = false)
    private int includedEmails;

    @Column(name = "included_whatsapp", nullable = false)
    private int includedWhatsapp;

    @Column(name = "included_sms", nullable = false)
    private int includedSms;

    @Column(name = "overage_email_micros", nullable = false)
    private long overageEmailMicros;

    @Column(name = "overage_whatsapp_micros", nullable = false)
    private long overageWhatsappMicros;

    @Column(name = "overage_sms_micros", nullable = false)
    private long overageSmsMicros;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "features", nullable = false)
    private JsonNode features;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
