package com.omniflow.crm.dto;

import java.util.List;

public record ImportJsonRequest(List<JsonContactRow> contacts) {
}
