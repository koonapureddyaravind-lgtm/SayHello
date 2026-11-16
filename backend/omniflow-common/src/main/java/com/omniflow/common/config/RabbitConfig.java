package com.omniflow.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    @Bean
    public TopicExchange omniflowEventsExchange() {
        return new TopicExchange(MessagingTopology.EXCHANGE, true, false);
    }

    @Bean
    public DirectExchange omniflowDeadLetterExchange() {
        return new DirectExchange(MessagingTopology.DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(MessagingTopology.DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Declarables deadLetterBindings(Queue deadLetterQueue, DirectExchange omniflowDeadLetterExchange) {
        // Queues dead-letter with the exact key "dead.<queueName>"; a direct exchange matches
        // keys literally, so bind each key instead of the topic wildcard "dead.#" (which never matched).
        return new Declarables(
                BindingBuilder.bind(deadLetterQueue).to(omniflowDeadLetterExchange).with("dead." + MessagingTopology.Q_CAMPAIGN_LAUNCH),
                BindingBuilder.bind(deadLetterQueue).to(omniflowDeadLetterExchange).with("dead." + MessagingTopology.Q_MESSAGE_SEND),
                BindingBuilder.bind(deadLetterQueue).to(omniflowDeadLetterExchange).with("dead." + MessagingTopology.Q_AUTOMATION_TRIGGER),
                BindingBuilder.bind(deadLetterQueue).to(omniflowDeadLetterExchange).with("dead." + MessagingTopology.Q_AUTOMATION_CONTACT_CREATED),
                BindingBuilder.bind(deadLetterQueue).to(omniflowDeadLetterExchange).with("dead." + MessagingTopology.Q_WEBHOOK_PROCESS),
                BindingBuilder.bind(deadLetterQueue).to(omniflowDeadLetterExchange).with("dead." + MessagingTopology.Q_CONTACT_IMPORT));
    }

    private Queue durableWithDlq(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange", MessagingTopology.DEAD_LETTER_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", "dead." + name)
                .build();
    }

    @Bean
    public Queue campaignLaunchQueue() {
        return durableWithDlq(MessagingTopology.Q_CAMPAIGN_LAUNCH);
    }

    @Bean
    public Binding campaignLaunchBinding(Queue campaignLaunchQueue, TopicExchange omniflowEventsExchange) {
        return BindingBuilder.bind(campaignLaunchQueue).to(omniflowEventsExchange)
                .with(MessagingTopology.CAMPAIGN_LAUNCH);
    }

    @Bean
    public Queue messageSendQueue() {
        return durableWithDlq(MessagingTopology.Q_MESSAGE_SEND);
    }

    @Bean
    public Binding messageSendBinding(Queue messageSendQueue, TopicExchange omniflowEventsExchange) {
        return BindingBuilder.bind(messageSendQueue).to(omniflowEventsExchange)
                .with(MessagingTopology.MESSAGE_SEND);
    }

    @Bean
    public Queue automationTriggerQueue() {
        return durableWithDlq(MessagingTopology.Q_AUTOMATION_TRIGGER);
    }

    @Bean
    public Binding automationTriggerBinding(Queue automationTriggerQueue, TopicExchange omniflowEventsExchange) {
        return BindingBuilder.bind(automationTriggerQueue).to(omniflowEventsExchange)
                .with(MessagingTopology.AUTOMATION_TRIGGER);
    }

    @Bean
    public Queue automationContactCreatedQueue() {
        return durableWithDlq(MessagingTopology.Q_AUTOMATION_CONTACT_CREATED);
    }

    @Bean
    public Binding automationContactCreatedBinding(Queue automationContactCreatedQueue,
                                                   TopicExchange omniflowEventsExchange) {
        return BindingBuilder.bind(automationContactCreatedQueue).to(omniflowEventsExchange)
                .with(MessagingTopology.CONTACT_CREATED);
    }

    @Bean
    public Queue webhookProcessQueue() {
        return durableWithDlq(MessagingTopology.Q_WEBHOOK_PROCESS);
    }

    @Bean
    public Binding webhookProcessBinding(Queue webhookProcessQueue, TopicExchange omniflowEventsExchange) {
        return BindingBuilder.bind(webhookProcessQueue).to(omniflowEventsExchange)
                .with(MessagingTopology.WEBHOOK_PROCESS);
    }

    @Bean
    public Queue contactImportQueue() {
        return durableWithDlq(MessagingTopology.Q_CONTACT_IMPORT);
    }

    @Bean
    public Binding contactImportBinding(Queue contactImportQueue, TopicExchange omniflowEventsExchange) {
        return BindingBuilder.bind(contactImportQueue).to(omniflowEventsExchange)
                .with(MessagingTopology.CONTACT_IMPORT_REQUESTED);
    }

    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}
