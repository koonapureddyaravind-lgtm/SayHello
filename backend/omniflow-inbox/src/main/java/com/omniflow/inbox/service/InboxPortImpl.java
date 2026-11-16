package com.omniflow.inbox.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.domain.enums.ConversationStatus;
import com.omniflow.common.domain.enums.Direction;
import com.omniflow.common.domain.enums.SenderType;
import com.omniflow.common.port.ContactDirectory;
import com.omniflow.common.port.ContactInfo;
import com.omniflow.common.port.InboundMessage;
import com.omniflow.common.port.InboxPort;
import com.omniflow.inbox.domain.Conversation;
import com.omniflow.inbox.domain.ConversationMessage;
import com.omniflow.inbox.repository.ConversationMessageRepository;
import com.omniflow.inbox.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Receives inbound provider messages from the messaging module and folds them into the
 * conversation timeline. Duplicate provider message ids are ignored.
 */
@Service
@RequiredArgsConstructor
public class InboxPortImpl implements InboxPort {

    private static final Logger log = LoggerFactory.getLogger(InboxPortImpl.class);

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final ContactDirectory contactDirectory;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void handleInbound(InboundMessage message) {
        if (message == null || message.organizationId() == null || message.channel() == null) {
            log.warn("Ignoring malformed inbound message");
            return;
        }
        String fromAddress = message.fromAddress();
        if (fromAddress == null || fromAddress.isBlank()) {
            log.warn("Ignoring inbound message without a from address");
            return;
        }

        Map<String, Object> payload = message.payload() == null ? Map.of() : message.payload();
        String providerMessageId = firstNonBlank(
                payload.get("providerMessageId"),
                payload.get("provider_message_id"),
                payload.get("messageId"));
        UUID organizationId = message.organizationId();

        if (providerMessageId != null
                && messageRepository.existsByOrganizationIdAndProviderMessageId(organizationId, providerMessageId)) {
            log.debug("Duplicate inbound message {} ignored", providerMessageId);
            return;
        }

        String contactName = firstNonBlank(
                payload.get("contactName"),
                payload.get("profileName"),
                payload.get("name"));

        ContactInfo contact = contactDirectory.findOrCreateByAddress(
                organizationId, message.channel(), fromAddress, contactName);
        if (contact == null) {
            log.warn("Unable to resolve contact for inbound address {}", fromAddress);
            return;
        }

        Instant occurredAt = message.occurredAt() == null ? Instant.now() : message.occurredAt();

        Conversation conversation = conversationRepository
                .findByOrganizationIdAndContactIdAndChannel(organizationId, contact.id(), message.channel())
                .orElseGet(() -> {
                    Conversation created = new Conversation();
                    created.setOrganizationId(organizationId);
                    created.setContactId(contact.id());
                    created.setChannel(message.channel());
                    created.setProviderAccountId(message.providerAccountId());
                    created.setStatus(ConversationStatus.OPEN);
                    created.setSubject(message.subject());
                    created.setLastMessageAt(occurredAt);
                    created.setUnreadCount(0);
                    return created;
                });

        conversation.setLastMessageAt(occurredAt);
        conversation.setUnreadCount(conversation.getUnreadCount() + 1);
        conversation.setStatus(ConversationStatus.OPEN);
        if (conversation.getProviderAccountId() == null) {
            conversation.setProviderAccountId(message.providerAccountId());
        }
        if (conversation.getSubject() == null && message.subject() != null) {
            conversation.setSubject(message.subject());
        }
        conversationRepository.save(conversation);

        ConversationMessage row = new ConversationMessage();
        row.setConversationId(conversation.getId());
        row.setOrganizationId(organizationId);
        row.setDirection(Direction.INBOUND);
        row.setSenderType(SenderType.CONTACT);
        row.setSenderUserId(null);
        row.setBody(message.body() == null ? "" : message.body());
        row.setAttachments(objectMapper.createArrayNode());
        row.setProviderMessageId(providerMessageId);
        row.setStatus("RECEIVED");
        messageRepository.save(row);
    }

    private static String firstNonBlank(Object... values) {
        for (Object value : values) {
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return null;
    }
}
