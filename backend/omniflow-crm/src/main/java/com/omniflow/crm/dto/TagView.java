package com.omniflow.crm.dto;

import java.util.UUID;

public record TagView(UUID id, String name, String color, long contactCount) {
}
