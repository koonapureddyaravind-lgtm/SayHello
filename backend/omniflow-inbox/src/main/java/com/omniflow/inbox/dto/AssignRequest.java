package com.omniflow.inbox.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssignRequest(@NotNull UUID userId) {
}
