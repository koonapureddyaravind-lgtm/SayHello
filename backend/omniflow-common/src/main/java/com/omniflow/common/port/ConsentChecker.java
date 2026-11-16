package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;

import java.util.UUID;

public interface ConsentChecker {

    /**
     * True only when the latest consent record for the contact/channel/purpose is GRANTED.
     * Transactional sends may fall back to a transactional consent record.
     */
    boolean canSend(UUID organizationId, UUID contactId, Channel channel, ConsentPurpose purpose);
}
