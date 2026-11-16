package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface ContactDirectory {

    Optional<ContactInfo> find(UUID organizationId, UUID contactId);

    List<ContactInfo> findByIds(UUID organizationId, Collection<UUID> contactIds);

    /**
     * Resolves a contact by email/phone, creating one when an inbound message arrives
     * from an unknown address.
     */
    ContactInfo findOrCreateByAddress(UUID organizationId, Channel channel, String address, String displayName);

    void addActivity(UUID organizationId, UUID contactId, String type, Channel channel, Map<String, Object> payload);

    void addTag(UUID organizationId, UUID contactId, String tagName);
}
