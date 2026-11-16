package com.omniflow.common.api;

import java.util.List;

/**
 * Stable pagination payload. {@code page} is zero-based.
 */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    public static <T> PageResponse<T> of(List<T> items, int page, int size, long totalItems) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) totalItems / size);
        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }

    public static <T> PageResponse<T> empty(int page, int size) {
        return new PageResponse<>(List.of(), page, size, 0, 0);
    }
}
