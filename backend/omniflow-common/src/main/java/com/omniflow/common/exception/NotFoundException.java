package com.omniflow.common.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public class NotFoundException extends ApiException {

    public NotFoundException(String resource, Object id) {
        super(HttpStatus.NOT_FOUND, "NOT_FOUND", resource + " not found",
                Map.of("resource", resource, "id", String.valueOf(id)));
    }

    public NotFoundException(String code, String message) {
        super(HttpStatus.NOT_FOUND, code, message);
    }
}
