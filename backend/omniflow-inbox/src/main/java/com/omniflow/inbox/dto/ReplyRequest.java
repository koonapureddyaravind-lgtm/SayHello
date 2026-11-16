package com.omniflow.inbox.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReplyRequest(
        @NotBlank @Size(max = 20000) String body
) {
}
