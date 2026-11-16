package com.omniflow.campaign.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record ScheduleRequest(@NotNull @Future Instant scheduledAt) {
}
