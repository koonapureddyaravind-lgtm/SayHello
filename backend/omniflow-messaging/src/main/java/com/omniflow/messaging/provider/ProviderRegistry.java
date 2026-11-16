package com.omniflow.messaging.provider;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Maps provider_accounts.provider codes to channel adapter beans.
 */
@Component
public class ProviderRegistry {

    private final Map<String, MessageProvider> providers = new LinkedHashMap<>();

    public ProviderRegistry(List<MessageProvider> providerBeans) {
        for (MessageProvider provider : providerBeans) {
            register(provider.providerCode(), provider);
            provider.aliases().forEach(alias -> register(alias, provider));
        }
    }

    private void register(String code, MessageProvider provider) {
        if (code != null) {
            providers.put(code.toUpperCase(Locale.ROOT), provider);
        }
    }

    public Optional<MessageProvider> find(String providerCode) {
        if (providerCode == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(providers.get(providerCode.toUpperCase(Locale.ROOT)));
    }

    public Set<String> registeredCodes() {
        return providers.keySet();
    }
}
