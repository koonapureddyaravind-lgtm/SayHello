package com.omniflow.consent.service;

import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.ConsentStatus;
import com.omniflow.common.domain.enums.SuppressionReason;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.ContactDirectory;
import com.omniflow.common.port.ContactInfo;
import com.omniflow.common.util.PageMapper;
import com.omniflow.consent.domain.ConsentRecord;
import com.omniflow.consent.domain.SuppressionRecord;
import com.omniflow.consent.dto.ConsentView;
import com.omniflow.consent.dto.CreateSuppressionRequest;
import com.omniflow.consent.dto.RecordConsentRequest;
import com.omniflow.consent.dto.SuppressionView;
import com.omniflow.consent.repository.ConsentRecordRepository;
import com.omniflow.consent.repository.SuppressionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConsentService {

    private final ConsentRecordRepository consentRecordRepository;
    private final SuppressionRecordRepository suppressionRecordRepository;
    private final ContactDirectory contactDirectory;

    @Transactional(readOnly = true)
    public PageResponse<ConsentView> list(UUID organizationId,
                                          UUID contactId,
                                          Channel channel,
                                          PageQuery pageQuery) {
        Page<ConsentRecord> page = consentRecordRepository.history(
                organizationId, contactId, channel, pageQuery.toPageRequest());
        return PageMapper.of(page, this::toView);
    }

    @Transactional
    public ConsentView record(UUID organizationId, RecordConsentRequest request) {
        ContactInfo contact = contactDirectory.find(organizationId, request.contactId())
                .orElseThrow(() -> new NotFoundException("Contact", request.contactId()));

        ConsentRecord record = new ConsentRecord();
        record.setOrganizationId(organizationId);
        record.setContactId(contact.id());
        record.setChannel(request.channel());
        record.setPurpose(request.purpose() == null ? ConsentPurpose.MARKETING : request.purpose());
        record.setStatus(request.status());
        record.setSource(request.source().trim());
        record.setEvidence(request.evidence() == null ? new HashMap<>() : new HashMap<>(request.evidence()));
        record.setOccurredAt(Instant.now());

        ConsentRecord saved = consentRecordRepository.save(record);

        if (saved.getPurpose() == ConsentPurpose.MARKETING
                && (saved.getStatus() == ConsentStatus.WITHDRAWN || saved.getStatus() == ConsentStatus.DENIED)) {
            String email = saved.getChannel() == Channel.EMAIL ? contact.email() : null;
            String phone = saved.getChannel() == Channel.EMAIL ? null : contact.phone();
            if (email == null && phone == null) {
                email = contact.email();
                phone = contact.phone();
            }
            if (email != null || phone != null) {
                findOrCreateSuppression(organizationId, email, phone, saved.getChannel(),
                        SuppressionReason.UNSUBSCRIBE,
                        "Marketing consent " + saved.getStatus().name().toLowerCase(Locale.ROOT),
                        null);
            }
        }
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<SuppressionView> listSuppressions(UUID organizationId, PageQuery pageQuery) {
        Page<SuppressionRecord> page = suppressionRecordRepository
                .findByOrganizationIdOrderByCreatedAtDesc(organizationId, pageQuery.toPageRequest());
        return PageMapper.of(page, this::toView);
    }

    @Transactional
    public SuppressionView addSuppression(UUID organizationId, CreateSuppressionRequest request) {
        String email = normalizeEmail(request.email());
        String phone = normalizePhone(request.phone());
        if (email == null && phone == null) {
            throw new BadRequestException("SUPPRESSION_TARGET_REQUIRED",
                    "At least one of email or phone is required");
        }
        if (request.reason() == null) {
            throw new BadRequestException("SUPPRESSION_REASON_REQUIRED", "A suppression reason is required");
        }
        SuppressionRecord saved = findOrCreateSuppression(organizationId, email, phone,
                request.channel(), request.reason(),
                request.note() == null ? null : request.note().trim(),
                request.expiresAt());
        return toView(saved);
    }

    @Transactional
    public void removeSuppression(UUID organizationId, UUID id) {
        SuppressionRecord record = suppressionRecordRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new NotFoundException("Suppression", id));
        suppressionRecordRepository.delete(record);
    }

    private SuppressionRecord findOrCreateSuppression(UUID organizationId,
                                                      String email,
                                                      String phone,
                                                      Channel channel,
                                                      SuppressionReason reason,
                                                      String note,
                                                      Instant expiresAt) {
        List<SuppressionRecord> existing = suppressionRecordRepository
                .findMatching(organizationId, email, phone, channel);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        SuppressionRecord record = new SuppressionRecord();
        record.setOrganizationId(organizationId);
        record.setChannel(channel);
        record.setEmail(email);
        record.setPhone(phone);
        record.setReason(reason);
        record.setNote(note);
        record.setExpiresAt(expiresAt);
        return suppressionRecordRepository.save(record);
    }

    private ConsentView toView(ConsentRecord record) {
        return new ConsentView(
                record.getId(),
                record.getContactId(),
                record.getChannel(),
                record.getPurpose(),
                record.getStatus(),
                record.getSource(),
                record.getIpAddress(),
                record.getEvidence(),
                record.getOccurredAt(),
                record.getCreatedAt());
    }

    private SuppressionView toView(SuppressionRecord record) {
        return new SuppressionView(
                record.getId(),
                record.getChannel(),
                record.getEmail(),
                record.getPhone(),
                record.getReason(),
                record.getNote(),
                record.getExpiresAt(),
                record.getCreatedAt());
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String trimmed = email.trim().toLowerCase(Locale.ROOT);
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizePhone(String phone) {
        if (phone == null) {
            return null;
        }
        String trimmed = phone.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
