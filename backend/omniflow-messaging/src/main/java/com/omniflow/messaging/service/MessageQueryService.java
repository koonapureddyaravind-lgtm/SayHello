package com.omniflow.messaging.service;

import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.MessageStatus;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.outbox.OutboxWriter;
import com.omniflow.common.util.PageMapper;
import com.omniflow.messaging.dto.MessageEventView;
import com.omniflow.messaging.dto.MessageView;
import com.omniflow.messaging.entity.Message;
import com.omniflow.messaging.entity.MessageEvent;
import com.omniflow.messaging.repository.MessageEventRepository;
import com.omniflow.messaging.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageQueryService {

    private final MessageRepository messageRepository;
    private final MessageEventRepository messageEventRepository;
    private final OutboxWriter outboxWriter;

    @Transactional(readOnly = true)
    public PageResponse<MessageView> list(UUID organizationId,
                                          PageQuery pageQuery,
                                          Channel channel,
                                          MessageStatus status,
                                          UUID campaignId,
                                          UUID contactId) {
        return PageMapper.of(messageRepository.search(
                organizationId, channel, status, campaignId, contactId, pageQuery.toPageRequest()), this::toView);
    }

    @Transactional(readOnly = true)
    public MessageView get(UUID organizationId, UUID messageId) {
        return toView(requireMessage(organizationId, messageId));
    }

    @Transactional(readOnly = true)
    public List<MessageEventView> events(UUID organizationId, UUID messageId) {
        requireMessage(organizationId, messageId);
        return messageEventRepository.findByMessageIdAndOrganizationIdOrderByEventTimeDesc(messageId, organizationId)
                .stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public MessageView retry(UUID organizationId, UUID messageId) {
        Message message = requireMessage(organizationId, messageId);
        if (message.getStatus() != MessageStatus.FAILED && message.getStatus() != MessageStatus.QUEUED) {
            throw new BadRequestException("MESSAGE_NOT_RETRYABLE",
                    "Only FAILED or QUEUED messages can be retried");
        }

        message.setStatus(MessageStatus.QUEUED);
        message.setErrorCode(null);
        message.setErrorMessage(null);
        message.setFailedAt(null);
        message.setQueuedAt(Instant.now());
        messageRepository.save(message);

        Map<String, Object> payload = new HashMap<>();
        payload.put("messageId", message.getId());
        payload.put("organizationId", message.getOrganizationId());
        payload.put("channel", message.getChannel().name());
        outboxWriter.write("message", message.getId(), MessagingTopology.MESSAGE_SEND,
                message.getOrganizationId(), payload);

        return toView(message);
    }

    private Message requireMessage(UUID organizationId, UUID messageId) {
        return messageRepository.findByIdAndOrganizationId(messageId, organizationId)
                .orElseThrow(() -> new NotFoundException("Message", messageId));
    }

    private MessageView toView(Message message) {
        return new MessageView(
                message.getId(),
                message.getOrganizationId(),
                message.getCampaignId(),
                message.getContactId(),
                message.getChannel(),
                message.getProviderAccountId(),
                message.getDirection(),
                message.getProvider(),
                message.getProviderMessageId(),
                message.getIdempotencyKey(),
                message.getStatus(),
                message.getSubject(),
                message.getBody(),
                message.getHtmlBody(),
                message.getToAddress(),
                message.getFromAddress(),
                message.getErrorCode(),
                message.getErrorMessage(),
                message.getScheduledAt(),
                message.getQueuedAt(),
                message.getSentAt(),
                message.getDeliveredAt(),
                message.getReadAt(),
                message.getFailedAt(),
                message.getMetadata() == null ? Map.of() : message.getMetadata(),
                message.getCreatedAt(),
                message.getUpdatedAt());
    }

    private MessageEventView toView(MessageEvent event) {
        return new MessageEventView(
                event.getId(),
                event.getMessageId(),
                event.getProvider(),
                event.getProviderEventId(),
                event.getEventType(),
                event.getEventTime(),
                event.getPayload() == null ? Map.of() : event.getPayload(),
                event.getProcessedAt(),
                event.getCreatedAt());
    }
}
