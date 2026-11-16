package com.omniflow.automation.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TestWorkflowRequest(@NotNull UUID contactId) {
}
