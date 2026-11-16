package com.omniflow.billing.service;

import com.omniflow.billing.domain.Plan;
import com.omniflow.billing.domain.Subscription;
import com.omniflow.billing.domain.UsageRecord;
import com.omniflow.billing.repository.PlanRepository;
import com.omniflow.billing.repository.SubscriptionRepository;
import com.omniflow.billing.repository.UsageRecordRepository;
import com.omniflow.common.domain.enums.UsageMetric;
import com.omniflow.common.port.BillingPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.util.UUID;

/**
 * Best-effort metering entry point. Usage writes are isolated from the caller transaction so a
 * duplicate key never rolls back message delivery.
 */
@Service
@RequiredArgsConstructor
public class BillingPortImpl implements BillingPort {

    private static final Logger log = LoggerFactory.getLogger(BillingPortImpl.class);

    private final UsageRecordRepository usageRecordRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final PlanRepository planRepository;

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void recordUsage(UUID organizationId,
                            UsageMetric metric,
                            int quantity,
                            UUID campaignId,
                            UUID messageId) {
        if (organizationId == null || metric == null || quantity <= 0) {
            return;
        }
        if (messageId != null && usageRecordRepository.existsByMessageIdAndMetric(messageId, metric)) {
            return;
        }

        YearMonth current = YearMonth.now();
        UsageRecord record = new UsageRecord();
        record.setOrganizationId(organizationId);
        record.setMetric(metric);
        record.setQuantity(quantity);
        record.setUnitCostMicros(unitCostMicros(organizationId, metric));
        record.setPeriodStart(current.atDay(1));
        record.setPeriodEnd(current.atEndOfMonth());
        record.setCampaignId(campaignId);
        record.setMessageId(messageId);

        try {
            usageRecordRepository.saveAndFlush(record);
        } catch (DataIntegrityViolationException ex) {
            log.debug("Duplicate usage record for message {} metric {} ignored", messageId, metric);
        }
    }

    private long unitCostMicros(UUID organizationId, UsageMetric metric) {
        return subscriptionRepository.findByOrganizationId(organizationId)
                .map(Subscription::getPlanId)
                .flatMap(planRepository::findById)
                .map(plan -> overageMicros(plan, metric))
                .orElse(0L);
    }

    private long overageMicros(Plan plan, UsageMetric metric) {
        return switch (metric) {
            case EMAIL_SENT -> plan.getOverageEmailMicros();
            case WHATSAPP_SENT -> plan.getOverageWhatsappMicros();
            case SMS_SENT -> plan.getOverageSmsMicros();
            default -> 0L;
        };
    }
}
