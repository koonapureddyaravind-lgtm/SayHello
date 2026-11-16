package com.omniflow.common.config;

/**
 * Canonical RabbitMQ names. Mirror of docs/00-decisions.md section 7.
 */
public final class MessagingTopology {

    public static final String EXCHANGE = "omniflow.events";
    public static final String DEAD_LETTER_EXCHANGE = "omniflow.dlx";
    public static final String DEAD_LETTER_QUEUE = "q.dead.letter";

    public static final String CAMPAIGN_LAUNCH = "campaign.launch";
    public static final String MESSAGE_SEND = "message.send";
    public static final String AUTOMATION_TRIGGER = "automation.trigger";
    public static final String WEBHOOK_PROCESS = "webhook.process";
    public static final String CONTACT_CREATED = "contact.created";
    public static final String CONTACT_IMPORT_REQUESTED = "contact.import.requested";
    public static final String CAMPAIGN_DISPATCHED = "campaign.dispatched";

    public static final String Q_CAMPAIGN_LAUNCH = "q.campaign.launch";
    public static final String Q_MESSAGE_SEND = "q.message.send";
    public static final String Q_AUTOMATION_TRIGGER = "q.automation.trigger";
    public static final String Q_WEBHOOK_PROCESS = "q.webhook.process";
    public static final String Q_AUTOMATION_CONTACT_CREATED = "q.automation.contact-created";
    public static final String Q_CONTACT_IMPORT = "q.contact.import";

    private MessagingTopology() {
    }
}
