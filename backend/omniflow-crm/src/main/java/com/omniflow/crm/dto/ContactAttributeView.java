package com.omniflow.crm.dto;

import java.util.UUID;

public record ContactAttributeView(UUID id, String key, String label, String dataType) {
}
