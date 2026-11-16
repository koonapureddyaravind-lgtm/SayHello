package com.omniflow.common.port;

import java.util.UUID;

public record UserSummary(UUID id, String email, String fullName, String status) {
}
