package com.omniflow.billing.scheduler;

import com.omniflow.billing.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs on the 1st of every month at 02:15 and bills the previous month.
 */
@Component
@Profile("worker")
@RequiredArgsConstructor
public class BillingScheduler {

    private static final Logger log = LoggerFactory.getLogger(BillingScheduler.class);

    private final BillingService billingService;

    @Scheduled(cron = "0 15 2 1 * *")
    public void generateMonthlyInvoices() {
        try {
            billingService.generateMonthlyInvoices();
        } catch (RuntimeException ex) {
            log.error("Monthly invoice generation failed", ex);
        }
    }
}
