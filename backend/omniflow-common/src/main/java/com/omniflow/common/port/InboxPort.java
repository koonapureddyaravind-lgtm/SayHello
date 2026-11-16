package com.omniflow.common.port;

public interface InboxPort {

    /**
     * Resolves or creates the conversation for the inbound message and appends it.
     */
    void handleInbound(InboundMessage message);
}
