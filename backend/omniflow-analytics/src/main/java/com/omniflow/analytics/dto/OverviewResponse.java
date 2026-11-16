package com.omniflow.analytics.dto;

public record OverviewResponse(
        Contacts contacts,
        Messages messages,
        Campaigns campaigns,
        Inbox inbox,
        Usage usage
) {
    public record Contacts(long total, long newInPeriod) {
    }

    public record Messages(long sent, long delivered, long failed, double deliveryRate) {
    }

    public record Campaigns(long active, long completed) {
    }

    public record Inbox(long openConversations, long unreadMessages) {
    }

    public record Usage(long email, long whatsapp, long sms) {
    }
}
