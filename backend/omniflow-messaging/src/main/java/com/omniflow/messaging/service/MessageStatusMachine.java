package com.omniflow.messaging.service;

import com.omniflow.common.domain.enums.MessageStatus;

import java.util.Map;
import java.util.Set;

/**
 * Authoritative message status transition table (docs/00-decisions.md section 8).
 * Illegal transitions are ignored by callers.
 */
public final class MessageStatusMachine {

    private static final Map<MessageStatus, Set<MessageStatus>> TRANSITIONS = Map.of(
            MessageStatus.CREATED, Set.of(MessageStatus.QUEUED, MessageStatus.CANCELLED),
            MessageStatus.QUEUED, Set.of(MessageStatus.SENDING, MessageStatus.CANCELLED, MessageStatus.FAILED),
            MessageStatus.SENDING, Set.of(MessageStatus.SENT, MessageStatus.FAILED,
                    MessageStatus.REJECTED, MessageStatus.UNDELIVERABLE),
            MessageStatus.SENT, Set.of(MessageStatus.DELIVERED, MessageStatus.READ,
                    MessageStatus.BOUNCED, MessageStatus.FAILED),
            MessageStatus.DELIVERED, Set.of(MessageStatus.READ)
    );

    private static final Set<MessageStatus> TERMINAL = Set.of(
            MessageStatus.READ,
            MessageStatus.FAILED,
            MessageStatus.BOUNCED,
            MessageStatus.REJECTED,
            MessageStatus.UNDELIVERABLE,
            MessageStatus.CANCELLED
    );

    private MessageStatusMachine() {
    }

    public static boolean canTransition(MessageStatus from, MessageStatus to) {
        if (from == null || to == null) {
            return false;
        }
        return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }

    public static boolean isTerminal(MessageStatus status) {
        return status != null && TERMINAL.contains(status);
    }
}
