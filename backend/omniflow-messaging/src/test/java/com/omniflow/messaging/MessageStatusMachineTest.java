package com.omniflow.messaging;

import com.omniflow.common.domain.enums.MessageStatus;
import com.omniflow.messaging.service.MessageStatusMachine;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MessageStatusMachineTest {

    @Test
    void allowsDocumentedForwardTransitions() {
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.CREATED, MessageStatus.QUEUED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.QUEUED, MessageStatus.SENDING));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENDING, MessageStatus.SENT));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENT, MessageStatus.DELIVERED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.DELIVERED, MessageStatus.READ));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENT, MessageStatus.READ));
    }

    @Test
    void allowsCancellationAndFailurePaths() {
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.CREATED, MessageStatus.CANCELLED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.QUEUED, MessageStatus.CANCELLED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.QUEUED, MessageStatus.FAILED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENDING, MessageStatus.FAILED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENDING, MessageStatus.REJECTED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENDING, MessageStatus.UNDELIVERABLE));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENT, MessageStatus.BOUNCED));
        assertTrue(MessageStatusMachine.canTransition(MessageStatus.SENT, MessageStatus.FAILED));
    }

    @Test
    void rejectsIllegalTransitions() {
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.QUEUED, MessageStatus.SENT));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.QUEUED, MessageStatus.DELIVERED));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.SENDING, MessageStatus.DELIVERED));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.DELIVERED, MessageStatus.SENT));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.READ, MessageStatus.DELIVERED));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.FAILED, MessageStatus.QUEUED));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.CANCELLED, MessageStatus.SENT));
        assertFalse(MessageStatusMachine.canTransition(null, MessageStatus.QUEUED));
        assertFalse(MessageStatusMachine.canTransition(MessageStatus.QUEUED, null));
    }

    @Test
    void identifiesTerminalStatuses() {
        assertTrue(MessageStatusMachine.isTerminal(MessageStatus.READ));
        assertTrue(MessageStatusMachine.isTerminal(MessageStatus.FAILED));
        assertTrue(MessageStatusMachine.isTerminal(MessageStatus.BOUNCED));
        assertTrue(MessageStatusMachine.isTerminal(MessageStatus.REJECTED));
        assertTrue(MessageStatusMachine.isTerminal(MessageStatus.UNDELIVERABLE));
        assertTrue(MessageStatusMachine.isTerminal(MessageStatus.CANCELLED));

        assertFalse(MessageStatusMachine.isTerminal(MessageStatus.CREATED));
        assertFalse(MessageStatusMachine.isTerminal(MessageStatus.QUEUED));
        assertFalse(MessageStatusMachine.isTerminal(MessageStatus.SENDING));
        assertFalse(MessageStatusMachine.isTerminal(MessageStatus.SENT));
        assertFalse(MessageStatusMachine.isTerminal(MessageStatus.DELIVERED));
        assertFalse(MessageStatusMachine.isTerminal(null));
    }
}
