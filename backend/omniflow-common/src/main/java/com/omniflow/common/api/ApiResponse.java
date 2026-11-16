package com.omniflow.common.api;

import java.time.Instant;

/**
 * Uniform response envelope used by every REST endpoint.
 */
public record ApiResponse<T>(boolean success, T data, ApiError error, Instant timestamp) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, Instant.now());
    }

    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(true, null, null, Instant.now());
    }

    public static ApiResponse<Void> error(ApiError error) {
        return new ApiResponse<>(false, null, error, Instant.now());
    }

    public static <T> ApiResponse<T> error(ApiError error, T data) {
        return new ApiResponse<>(false, data, error, Instant.now());
    }
}
