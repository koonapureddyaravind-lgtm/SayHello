package com.omniflow.automation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

public record PublishWorkflowRequest(@NotNull JsonNode graph) {
}
