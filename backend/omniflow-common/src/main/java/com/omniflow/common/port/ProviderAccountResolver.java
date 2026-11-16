package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

import java.util.Optional;
import java.util.UUID;

public interface ProviderAccountResolver {

    Optional<ProviderAccountInfo> findDefault(UUID organizationId, Channel channel);

    Optional<ProviderAccountInfo> find(UUID organizationId, UUID providerAccountId);

    /**
     * Used by provider webhooks, which only know the account id embedded in the callback URL.
     */
    Optional<ProviderAccountInfo> findById(UUID providerAccountId);

    /**
     * Routes an inbound WhatsApp message to the workspace that owns the destination phone
     * number, so one shared Meta callback URL can serve many workspaces.
     */
    Optional<ProviderAccountInfo> findByWhatsAppPhoneNumberId(String phoneNumberId);
}
