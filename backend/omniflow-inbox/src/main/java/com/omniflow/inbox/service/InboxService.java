package com.omniflow.inbox.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConversationStatus;
import com.omniflow.common.domain.enums.Direction;
import com.omniflow.common.domain.enums.SenderType;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.ContactDirectory;
import com.omniflow.common.port.ContactInfo;
import com.omniflow.common.port.MessageIntakePort;
import com.omniflow.common.port.OutboundMessageCommand;
import com.omniflow.common.util.PageMapper;
import com.omniflow.inbox.domain.Conversation;
import com.omniflow.inbox.domain.ConversationAssignment;
import com.omniflow.inbox.domain.ConversationMessage;
import com.omniflow.inbox.dto.ConversationMessageView;
import com.omniflow.inbox.dto.ConversationView;
import com.omniflow.inbox.repository.ConversationAssignmentRepository;
import com.omniflow.inbox.repository.ConversationMessageRepository;
import com.omniflow.inbox.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InboxService {

    private static final int PREVIEW_LENGTH = 200;

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final ConversationAssignmentRepository assignmentRepository;
    private final ContactDirectory contactDirectory;
    private final MessageIntakePort messageIntakePort;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PageResponse<ConversationView> list(UUID organizationId,
                                               PageQuery pageQuery,
                                               ConversationStatus status,
                                               Channel channel,
                                               UUID assignee,
                                               String q) {
        String search = q == null || q.isBlank()
                ? null
                : "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
        PageRequest pageable = pageQuery.toPageRequest();
        Page<Conversation> page = conversationRepository.search(
                organizationId, status, channel, assignee, search, pageable);

        List<Conversation> conversations = page.getContent();
        Map<UUID, ContactInfo> contacts = loadContacts(organizationId, conversations);
        Map<UUID, String> previews = lastMessagePreviews(
                organizationId, conversations.stream().map(Conversation::getId).toList());
        List<ConversationView> items = conversations.stream()
                .map(conversation -> toView(conversation, contacts.get(conversation.getContactId()),
                        previews.get(conversation.getId())))
                .toList();
        return PageResponse.of(items, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ConversationView get(UUID organizationId, UUID conversationId) {
        Conversation conversation = findConversation(organizationId, conversationId);
        ContactInfo contact = contactDirectory.find(organizationId, conversation.getContactId()).orElse(null);
        String preview = lastMessagePreviews(organizationId, List.of(conversationId)).get(conversationId);
        return toView(conversation, contact, preview);
    }

    @Transactional(readOnly = true)
    public PageResponse<ConversationMessageView> messages(UUID organizationId,
                                                          UUID conversationId,
                                                          PageQuery pageQuery) {
        findConversation(organizationId, conversationId);
        PageRequest pageable = pageQuery.toPageRequest();
        Page<ConversationMessage> page = messageRepository.findPage(conversationId, organizationId, pageable);
        return PageMapper.of(page, ConversationMessageView::of);
    }

    @Transactional
    public ConversationMessageView reply(UUID organizationId,
                                         UUID actorId,
                                         UUID conversationId,
                                         String body) {
        if (body == null || body.isBlank()) {
            throw new BadRequestException("EMPTY_MESSAGE", "Message body is required");
        }
        Conversation conversation = findConversation(organizationId, conversationId);
        ContactInfo contact = contactDirectory.find(organizationId, conversation.getContactId())
                .orElseThrow(() -> new NotFoundException("Contact", conversation.getContactId()));
        String address = contact.addressFor(conversation.getChannel());
        if (address == null || address.isBlank()) {
            throw new BadRequestException("CONTACT_HAS_NO_ADDRESS",
                    "The contact has no address for channel " + conversation.getChannel());
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("conversationId", conversationId.toString());

        messageIntakePort.enqueue(OutboundMessageCommand.builder()
                .organizationId(organizationId)
                .campaignId(null)
                .contactId(conversation.getContactId())
                .channel(conversation.getChannel())
                .templateId(null)
                .subject(null)
                .body(body)
                .htmlBody(null)
                .toAddress(address)
                .fromAddress(null)
                .providerAccountId(conversation.getProviderAccountId())
                .idempotencyKey("inbox:" + conversationId + ":" + UUID.randomUUID())
                .metadata(metadata)
                .scheduledAt(null)
                .build());

        ConversationMessage message = new ConversationMessage();
        message.setConversationId(conversationId);
        message.setOrganizationId(organizationId);
        message.setDirection(Direction.OUTBOUND);
        message.setSenderType(SenderType.AGENT);
        message.setSenderUserId(actorId);
        message.setBody(body);
        message.setAttachments(objectMapper.createArrayNode());
        message.setProviderMessageId(null);
        message.setStatus("QUEUED");
        messageRepository.save(message);

        conversation.setLastMessageAt(Instant.now());
        conversation.setStatus(ConversationStatus.OPEN);
        conversationRepository.save(conversation);

        return ConversationMessageView.of(message);
    }

    @Transactional
    public ConversationView assign(UUID organizationId,
                                   UUID conversationId,
                                   UUID userId,
                                   UUID actorId) {
        if (userId == null) {
            throw new BadRequestException("VALIDATION_ERROR", "userId is required");
        }
        Conversation conversation = findConversation(organizationId, conversationId);
        Instant now = Instant.now();

        boolean alreadyAssigned = assignmentRepository
                .findFirstByConversationIdAndUnassignedAtIsNullOrderByAssignedAtDesc(conversationId)
                .map(previous -> {
                    if (previous.getUserId().equals(userId)) {
                        return true;
                    }
                    previous.setUnassignedAt(now);
                    assignmentRepository.save(previous);
                    return false;
                })
                .orElse(false);

        conversation.setAssigneeUserId(userId);
        conversationRepository.save(conversation);

        if (!alreadyAssigned) {
            ConversationAssignment assignment = new ConversationAssignment();
            assignment.setConversationId(conversationId);
            assignment.setUserId(userId);
            assignment.setAssignedBy(actorId);
            assignment.setAssignedAt(now);
            assignmentRepository.save(assignment);
        }

        ContactInfo contact = contactDirectory.find(organizationId, conversation.getContactId()).orElse(null);
        return toView(conversation, contact, null);
    }

    @Transactional
    public ConversationView updateStatus(UUID organizationId,
                                         UUID conversationId,
                                         ConversationStatus status) {
        if (status == null) {
            throw new BadRequestException("VALIDATION_ERROR", "status is required");
        }
        Conversation conversation = findConversation(organizationId, conversationId);
        conversation.setStatus(status);
        if (status == ConversationStatus.RESOLVED) {
            conversation.setUnreadCount(0);
        }
        conversationRepository.save(conversation);
        ContactInfo contact = contactDirectory.find(organizationId, conversation.getContactId()).orElse(null);
        String preview = lastMessagePreviews(organizationId, List.of(conversationId)).get(conversationId);
        return toView(conversation, contact, preview);
    }

    private Conversation findConversation(UUID organizationId, UUID conversationId) {
        return conversationRepository.findByIdAndOrganizationId(conversationId, organizationId)
                .orElseThrow(() -> new NotFoundException("Conversation", conversationId));
    }

    private Map<UUID, ContactInfo> loadContacts(UUID organizationId, List<Conversation> conversations) {
        List<UUID> contactIds = conversations.stream()
                .map(Conversation::getContactId)
                .distinct()
                .toList();
        if (contactIds.isEmpty()) {
            return Map.of();
        }
        return contactDirectory.findByIds(organizationId, contactIds).stream()
                .collect(Collectors.toMap(ContactInfo::id, Function.identity(), (a, b) -> a));
    }

    private ConversationView toView(Conversation conversation, ContactInfo contact, String preview) {
        String name = contact == null ? null : contact.displayName();
        String address = contact == null ? null : contact.addressFor(conversation.getChannel());
        String previewText = preview == null
                ? null
                : (preview.length() > PREVIEW_LENGTH ? preview.substring(0, PREVIEW_LENGTH) : preview);
        return ConversationView.of(conversation, name, address, previewText);
    }

    private Map<UUID, String> lastMessagePreviews(UUID organizationId, List<UUID> conversationIds) {
        if (conversationIds.isEmpty()) {
            return Map.of();
        }
        String placeholders = String.join(",", Collections.nCopies(conversationIds.size(), "?"));
        String sql = """
                select distinct on (conversation_id) conversation_id, body
                from conversation_messages
                where organization_id = ? and conversation_id in (%s)
                order by conversation_id, created_at desc
                """.formatted(placeholders);

        List<Object> args = new ArrayList<>(conversationIds.size() + 1);
        args.add(organizationId);
        args.addAll(conversationIds);

        Map<UUID, String> previews = new HashMap<>();
        jdbcTemplate.query(sql, args.toArray(), (rs, rowNum) -> {
            UUID conversationId = rs.getObject("conversation_id", UUID.class);
            if (conversationId != null) {
                previews.put(conversationId, rs.getString("body"));
            }
            return null;
        });
        return previews;
    }
}
