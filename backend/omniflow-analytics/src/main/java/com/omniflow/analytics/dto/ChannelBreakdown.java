package com.omniflow.analytics.dto;

import com.omniflow.common.domain.enums.Channel;

public record ChannelBreakdown(
        Channel channel,
        long sent,
        long delivered,
        long failed,
        double deliveryRate
) {
}
