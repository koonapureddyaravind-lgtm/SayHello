package com.omniflow.segmentation.dto;

import com.omniflow.crm.dto.ContactView;

import java.util.List;

public record PreviewResult(long count, List<ContactView> sample) {

    public PreviewResult {
        sample = sample == null ? List.of() : List.copyOf(sample);
    }
}
