package com.omniflow.crm.port;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.ContactDirectory;
import com.omniflow.common.port.ContactInfo;
import com.omniflow.common.security.SecurityUtils;
import com.omniflow.crm.domain.Contact;
import com.omniflow.crm.domain.ContactActivity;
import com.omniflow.crm.domain.Tag;
import com.omniflow.crm.dto.UpsertContactRequest;
import com.omniflow.crm.dto.ContactView;
import com.omniflow.crm.repository.ContactActivityRepository;
import com.omniflow.crm.repository.ContactRepository;
import com.omniflow.crm.service.ContactService;
import com.omniflow.crm.service.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContactDirectoryImpl implements ContactDirectory {

    private final ContactRepository contactRepository;
    private final ContactActivityRepository activityRepository;
    private final ContactService contactService;
    private final TagService tagService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Override
    @Transactional(readOnly = true)
    public Optional<ContactInfo> find(UUID organizationId, UUID contactId) {
        return contactRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(contactId, organizationId)
                .map(this::toInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContactInfo> findByIds(UUID organizationId, Collection<UUID> contactIds) {
        if (contactIds == null || contactIds.isEmpty()) {
            return List.of();
        }
        return contactRepository
                .findByIdInAndOrganizationIdAndDeletedAtIsNull(contactIds, organizationId).stream()
                .map(this::toInfo)
                .toList();
    }

    @Override
    @Transactional
    public ContactInfo findOrCreateByAddress(UUID organizationId,
                                             Channel channel,
                                             String address,
                                             String displayName) {
        String normalized = address == null ? null : address.trim();
        if (normalized == null || normalized.isEmpty()) {
            throw new BadRequestException("CONTACT_ADDRESS_REQUIRED", "An address is required");
        }

        boolean emailChannel = channel == Channel.EMAIL;
        Optional<Contact> existing = emailChannel
                ? contactRepository.findByOrganizationIdAndEmailIgnoreCaseAndDeletedAtIsNull(
                        organizationId, normalized)
                : contactRepository.findByOrganizationIdAndPhoneAndDeletedAtIsNull(
                        organizationId, normalized);
        if (existing.isPresent()) {
            return toInfo(existing.get());
        }

        String firstName = null;
        String lastName = null;
        if (displayName != null && !displayName.isBlank()) {
            String[] parts = displayName.trim().split("\\s+", 2);
            firstName = parts[0];
            lastName = parts.length > 1 ? parts[1] : null;
        }

        UpsertContactRequest request = new UpsertContactRequest(
                emailChannel ? normalized : null,
                emailChannel ? null : normalized,
                firstName,
                lastName,
                "ACTIVE",
                "INBOUND",
                Map.of(),
                null);
        ContactView created = contactService.create(
                organizationId, SecurityUtils.currentUserIdOrNull(), request);
        Contact contact = contactRepository
                .findByIdAndOrganizationIdAndDeletedAtIsNull(created.id(), organizationId)
                .orElseThrow(() -> new NotFoundException("Contact", created.id()));
        return toInfo(contact);
    }

    @Override
    @Transactional
    public void addActivity(UUID organizationId,
                            UUID contactId,
                            String type,
                            Channel channel,
                            Map<String, Object> payload) {
        Contact contact = contactRepository
                .findByIdAndOrganizationIdAndDeletedAtIsNull(contactId, organizationId)
                .orElseThrow(() -> new NotFoundException("Contact", contactId));

        Instant occurredAt = Instant.now();
        ContactActivity activity = new ContactActivity();
        activity.setOrganizationId(organizationId);
        activity.setContactId(contactId);
        activity.setType(type);
        activity.setChannel(channel);
        activity.setPayload(payload == null ? Map.of() : payload);
        activity.setOccurredAt(occurredAt);
        activityRepository.save(activity);

        contact.setLastEngagementAt(occurredAt);
        contactRepository.save(contact);
    }

    @Override
    @Transactional
    public void addTag(UUID organizationId, UUID contactId, String tagName) {
        contactRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(contactId, organizationId)
                .orElseThrow(() -> new NotFoundException("Contact", contactId));
        Tag tag = tagService.findOrCreate(organizationId, tagName);
        jdbcTemplate.update("""
                insert into contact_tags (contact_id, tag_id)
                values (:contactId, :tagId)
                on conflict do nothing
                """, Map.of("contactId", contactId, "tagId", tag.getId()));
    }

    private ContactInfo toInfo(Contact contact) {
        return new ContactInfo(
                contact.getId(),
                contact.getOrganizationId(),
                contact.getEmail(),
                contact.getPhone(),
                contact.getFirstName(),
                contact.getLastName(),
                contact.getStatus(),
                contact.getAttributes() == null ? Map.of() : contact.getAttributes());
    }
}
