package com.omniflow.messaging.service;

import com.omniflow.common.config.MessagingTopology;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.outbox.OutboxWriter;
import com.omniflow.common.port.MessageIntakePort;
import com.omniflow.common.port.OutboundMessageCommand;
import com.omniflow.messaging.entity.Message;
import com.omniflow.messaging.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageIntakeService implements MessageIntakePort {

    private final MessageRepository messageRepository;
    private final OutboxWriter outboxWriter;

    @Override
    @Transactional
    public UUID enqueue(OutboundMessageCommand command) {
        if (command == null) {
            throw new BadRequestException("INVALID_MESSAGE", "Message command is required");
        }
        if (command.getIdempotencyKey() == null || command.getIdempotencyKey().isBlank()) {
            throw new BadRequestException("INVALID_MESSAGE", "Idempotency key is required");
        }
        if (command.getOrganizationId() == null) {
            throw new BadRequestException("INVALID_MESSAGE", "Organization is required");
        }
        if (command.getChannel() == null) {
            throw new BadRequestException("INVALID_MESSAGE", "Channel is required");
        }
        if (command.getToAddress() == null || command.getToAddress().isBlank()) {
            throw new BadRequestException("INVALID_MESSAGE", "Destination address is required");
        }

        return messageRepository.findByIdempotencyKey(command.getIdempotencyKey())
                .map(Message::getId)
                .orElseGet(() -> create(command));
    }

    private UUID create(OutboundMessageCommand command) {
        Message message = new Message();
        message.setOrganizationId(command.getOrganizationId());
        message.setCampaignId(command.getCampaignId());
        message.setContactId(command.getContactId());
        message.setChannel(command.getChannel());
        message.setProviderAccountId(command.getProviderAccountId());
        message.setDirection(com.omniflow.common.domain.enums.Direction.OUTBOUND);
        message.setIdempotencyKey(command.getIdempotencyKey());
        message.setStatus(com.omniflow.common.domain.enums.MessageStatus.QUEUED);
        message.setSubject(command.getSubject());
        message.setBody(command.getBody());
        message.setHtmlBody(command.getHtmlBody());
        message.setToAddress(command.getToAddress());
        message.setFromAddress(command.getFromAddress());
        message.setScheduledAt(command.getScheduledAt());
        message.setQueuedAt(Instant.now());
        message.setMetadata(command.getMetadata() == null ? Map.of() : command.getMetadata());
        messageRepository.save(message);

        Map<String, Object> payload = new HashMap<>();
        payload.put("messageId", message.getId());
        payload.put("organizationId", message.getOrganizationId());
        payload.put("channel", message.getChannel().name());
        outboxWriter.write("message", message.getId(), MessagingTopology.MESSAGE_SEND,
                message.getOrganizationId(), payload);
        return message.getId();
    }
}
