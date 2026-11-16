package com.omniflow.common.api;

/**
 * Machine-readable error payload. {@code code} is stable and safe to branch on.
 */
public record ApiError(String code, String message, Object details) {

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, null);
    }

    public static ApiError of(String code, String message, Object details) {
        return new ApiError(code, message, details);
    }
}
