package com.omniflow.common.util;

import com.omniflow.common.api.PageResponse;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public final class PageMapper {

    private PageMapper() {
    }

    public static <T, R> PageResponse<R> of(Page<T> page, Function<T, R> mapper) {
        List<R> items = page.getContent().stream().map(mapper).toList();
        return PageResponse.of(items, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    public static <T> PageResponse<T> of(Page<T> page) {
        return of(page, Function.identity());
    }
}
