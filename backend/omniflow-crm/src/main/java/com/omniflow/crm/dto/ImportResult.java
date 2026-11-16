package com.omniflow.crm.dto;

import java.util.List;

public record ImportResult(int created, int updated, int skipped, List<String> errors) {

    public ImportResult {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }
}
