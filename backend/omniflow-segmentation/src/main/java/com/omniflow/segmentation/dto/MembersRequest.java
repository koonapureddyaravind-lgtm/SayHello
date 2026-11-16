package com.omniflow.segmentation.dto;

import java.util.List;
import java.util.UUID;

public record MembersRequest(List<UUID> contactIds) {
}
