package com.omniflow.inbox.dto;

import com.omniflow.common.domain.enums.ConversationStatus;
import jakarta.validation.constraints.NotNull;

public record StatusRequest(@NotNull ConversationStatus status) {
}
