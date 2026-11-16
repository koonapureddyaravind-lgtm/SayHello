package com.omniflow.common.api;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/**
 * Validated pagination input. Clamps page >= 0 and 1 <= size <= 100.
 */
public record PageQuery(int page, int size) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public static PageQuery of(Integer page, Integer size) {
        int p = page == null ? 0 : Math.max(0, page);
        int s = size == null ? DEFAULT_SIZE : Math.min(MAX_SIZE, Math.max(1, size));
        return new PageQuery(p, s);
    }

    public PageRequest toPageRequest() {
        return PageRequest.of(page, size);
    }

    public PageRequest toPageRequest(Sort sort) {
        return PageRequest.of(page, size, sort);
    }
}
