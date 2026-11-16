package com.omniflow.billing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.omniflow.billing.domain.Invoice;
import com.omniflow.billing.domain.Plan;
import com.omniflow.billing.domain.Subscription;
import com.omniflow.billing.dto.InvoiceView;
import com.omniflow.billing.dto.PlanView;
import com.omniflow.billing.dto.SubscriptionView;
import com.omniflow.billing.dto.UsageLine;
import com.omniflow.billing.dto.UsageSummary;
import com.omniflow.billing.repository.InvoiceRepository;
import com.omniflow.billing.repository.PlanRepository;
import com.omniflow.billing.repository.SubscriptionRepository;
import com.omniflow.billing.repository.UsageRecordRepository;
import com.omniflow.common.domain.enums.InvoiceStatus;
import com.omniflow.common.domain.enums.SubscriptionStatus;
import com.omniflow.common.domain.enums.UsageMetric;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    public static final UUID FREE_PLAN_ID = UUID.fromString("20000000-0000-0000-0000-000000000005");
    private static final String FREE_PLAN_CODE = "FREE";
    private static final UUID STARTER_PLAN_ID = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final String STARTER_PLAN_CODE = "STARTER";
    private static final int PERIOD_DAYS = 30;
    private static final int TRIAL_DAYS = 14;
    private static final long MICROS_PER_CENT = 10_000L;
    private static final DateTimeFormatter INVOICE_PERIOD = DateTimeFormatter.ofPattern("yyyyMM");

    private final PlanRepository planRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UsageRecordRepository usageRecordRepository;
    private final InvoiceRepository invoiceRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<PlanView> plans() {
        return planRepository.findByIsPublicTrueOrderBySortOrder().stream()
                .map(PlanView::of)
                .toList();
    }

    @Transactional
    public SubscriptionView subscription(UUID organizationId) {
        Subscription subscription = loadOrCreateSubscription(organizationId);
        Plan plan = planRepository.findById(subscription.getPlanId()).orElse(null);
        return SubscriptionView.of(subscription, plan);
    }

    @Transactional
    public SubscriptionView changePlan(UUID organizationId, String planCode) {
        if (planCode == null || planCode.isBlank()) {
            throw new BadRequestException("VALIDATION_ERROR", "planCode is required");
        }
        Plan plan = planRepository.findByCode(planCode.trim())
                .orElseThrow(() -> new NotFoundException("PLAN_NOT_FOUND",
                        "Unknown plan code: " + planCode.trim()));

        Subscription subscription = subscriptionRepository.findByOrganizationId(organizationId)
                .orElseGet(() -> newSubscription(organizationId, plan));

        Instant now = Instant.now();
        subscription.setPlanId(plan.getId());
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setCanceledAt(null);
        subscription.setCurrentPeriodStart(now);
        subscription.setCurrentPeriodEnd(now.plus(PERIOD_DAYS, ChronoUnit.DAYS));
        if (isFreePlan(plan) || (subscription.getTrialEndsAt() != null
                && subscription.getTrialEndsAt().isBefore(now))) {
            subscription.setTrialEndsAt(null);
        }
        subscriptionRepository.save(subscription);
        updateOrganizationPlan(organizationId, plan.getId());
        return SubscriptionView.of(subscription, plan);
    }

    @Transactional
    public UsageSummary usage(UUID organizationId, String period) {
        YearMonth month = parsePeriod(period);
        Subscription subscription = loadOrCreateSubscription(organizationId);
        Plan plan = planRepository.findById(subscription.getPlanId())
                .orElseThrow(() -> new NotFoundException("Plan", subscription.getPlanId()));
        Map<UsageMetric, Long> used = aggregateUsage(
                organizationId, month.atDay(1), month.atEndOfMonth());
        return new UsageSummary(month.toString(), plan.getCode(), computeLines(plan, used));
    }

    @Transactional(readOnly = true)
    public List<InvoiceView> invoices(UUID organizationId) {
        return invoiceRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId).stream()
                .map(InvoiceView::of)
                .toList();
    }

    /**
     * Creates one invoice per active/trialing subscription for the previous calendar month.
     * Idempotent on the invoice number. Intentionally not wrapped in a single transaction so a
     * failure for one organization cannot roll back invoices already created for the others.
     */
    public void generateMonthlyInvoices() {
        YearMonth previous = YearMonth.now().minusMonths(1);
        String periodKey = previous.format(INVOICE_PERIOD);
        List<Subscription> subscriptions = subscriptionRepository.findByStatusIn(
                List.of(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING));

        for (Subscription subscription : subscriptions) {
            try {
                generateInvoiceFor(subscription, previous, periodKey);
            } catch (RuntimeException ex) {
                log.warn("Failed to generate invoice for organization {}: {}",
                        subscription.getOrganizationId(), ex.getMessage());
            }
        }
    }

    private void generateInvoiceFor(Subscription subscription, YearMonth month, String periodKey) {
        UUID organizationId = subscription.getOrganizationId();
        Plan plan = planRepository.findById(subscription.getPlanId()).orElse(null);
        if (plan == null) {
            return;
        }
        String shortId = organizationId.toString().substring(0, 8).toUpperCase(Locale.ROOT);
        String number = "INV-" + periodKey + "-" + shortId;
        if (invoiceRepository.existsByNumber(number)) {
            return;
        }

        Map<UsageMetric, Long> used = aggregateUsage(organizationId, month.atDay(1), month.atEndOfMonth());
        List<UsageLine> lines = computeLines(plan, used);

        ArrayNode lineItems = objectMapper.createArrayNode();
        long subtotal = plan.getPriceMonthlyCents();

        ObjectNode base = lineItems.addObject();
        base.put("description", plan.getName() + " plan (" + month + ")");
        base.put("quantity", 1);
        base.put("unitAmountCents", plan.getPriceMonthlyCents());
        base.put("amountCents", plan.getPriceMonthlyCents());

        for (UsageLine line : lines) {
            long cents = microsToCents(line.costMicros());
            if (cents <= 0) {
                continue;
            }
            ObjectNode item = lineItems.addObject();
            item.put("description", metricLabel(line.metric()) + " overage");
            item.put("metric", line.metric().name());
            item.put("quantity", line.overage());
            item.put("unitCostMicros", overageMicros(plan, line.metric()));
            item.put("amountCents", cents);
            subtotal += cents;
        }

        // Free plans (and custom plans without billable overage) should never
        // produce a zero-value invoice.
        if (subtotal <= 0) {
            return;
        }

        Invoice invoice = new Invoice();
        invoice.setOrganizationId(organizationId);
        invoice.setNumber(number);
        invoice.setStatus(InvoiceStatus.OPEN);
        invoice.setSubtotalCents(subtotal);
        invoice.setTaxCents(0);
        invoice.setTotalCents(subtotal);
        invoice.setCurrency(plan.getCurrency());
        invoice.setPeriodStart(month.atDay(1));
        invoice.setPeriodEnd(month.atEndOfMonth());
        invoice.setDueAt(Instant.now().plus(TRIAL_DAYS, ChronoUnit.DAYS));
        invoice.setLineItems(lineItems);
        invoiceRepository.save(invoice);
    }

    private Subscription loadOrCreateSubscription(UUID organizationId) {
        return subscriptionRepository.findByOrganizationId(organizationId)
                .orElseGet(() -> {
                    Plan free = defaultPlan();
                    Subscription created = newSubscription(organizationId, free);
                    subscriptionRepository.save(created);
                    updateOrganizationPlan(organizationId, free.getId());
                    return created;
                });
    }

    private Subscription newSubscription(UUID organizationId, Plan plan) {
        Instant now = Instant.now();
        boolean free = isFreePlan(plan);
        Subscription subscription = new Subscription();
        subscription.setOrganizationId(organizationId);
        subscription.setPlanId(plan.getId());
        subscription.setStatus(free ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING);
        subscription.setCurrentPeriodStart(now);
        subscription.setCurrentPeriodEnd(now.plus(PERIOD_DAYS, ChronoUnit.DAYS));
        subscription.setTrialEndsAt(free ? null : now.plus(TRIAL_DAYS, ChronoUnit.DAYS));
        return subscription;
    }

    private Plan defaultPlan() {
        return planRepository.findById(FREE_PLAN_ID)
                .or(() -> planRepository.findByCode(FREE_PLAN_CODE))
                .or(() -> planRepository.findById(STARTER_PLAN_ID))
                .or(() -> planRepository.findByCode(STARTER_PLAN_CODE))
                .orElseGet(() -> planRepository.findAllOrderBySortOrder().stream()
                        .findFirst()
                        .orElseThrow(() -> new NotFoundException("PLAN_NOT_CONFIGURED",
                                "No billing plans are configured")));
    }

    private boolean isFreePlan(Plan plan) {
        return FREE_PLAN_CODE.equalsIgnoreCase(plan.getCode());
    }

    private void updateOrganizationPlan(UUID organizationId, UUID planId) {
        jdbcTemplate.update("update organizations set plan_id = ? where id = ?", planId, organizationId);
    }

    private Map<UsageMetric, Long> aggregateUsage(UUID organizationId, java.time.LocalDate start, java.time.LocalDate end) {
        Map<UsageMetric, Long> used = new EnumMap<>(UsageMetric.class);
        for (UsageRecordRepository.MetricTotal total : usageRecordRepository.aggregate(organizationId, start, end)) {
            if (total.getMetric() != null) {
                used.put(total.getMetric(), total.getTotal() == null ? 0L : total.getTotal());
            }
        }
        return used;
    }

    private List<UsageLine> computeLines(Plan plan, Map<UsageMetric, Long> used) {
        List<UsageLine> lines = new ArrayList<>();
        for (UsageMetric metric : List.of(UsageMetric.EMAIL_SENT, UsageMetric.WHATSAPP_SENT, UsageMetric.SMS_SENT)) {
            long usedQuantity = used.getOrDefault(metric, 0L);
            long included = includedFor(plan, metric);
            long overage = Math.max(0, usedQuantity - included);
            long costMicros = overage * overageMicros(plan, metric);
            lines.add(new UsageLine(metric, usedQuantity, included, overage, costMicros));
        }
        return lines;
    }

    private long includedFor(Plan plan, UsageMetric metric) {
        return switch (metric) {
            case EMAIL_SENT -> plan.getIncludedEmails();
            case WHATSAPP_SENT -> plan.getIncludedWhatsapp();
            case SMS_SENT -> plan.getIncludedSms();
            default -> 0L;
        };
    }

    private long overageMicros(Plan plan, UsageMetric metric) {
        return switch (metric) {
            case EMAIL_SENT -> plan.getOverageEmailMicros();
            case WHATSAPP_SENT -> plan.getOverageWhatsappMicros();
            case SMS_SENT -> plan.getOverageSmsMicros();
            default -> 0L;
        };
    }

    private long microsToCents(long micros) {
        if (micros <= 0) {
            return 0L;
        }
        return (micros + MICROS_PER_CENT - 1) / MICROS_PER_CENT;
    }

    private String metricLabel(UsageMetric metric) {
        return switch (metric) {
            case EMAIL_SENT -> "Email";
            case WHATSAPP_SENT -> "WhatsApp";
            case SMS_SENT -> "SMS";
            default -> metric.name();
        };
    }

    private YearMonth parsePeriod(String period) {
        if (period == null || period.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(period.trim());
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("INVALID_PERIOD", "period must use the format YYYY-MM");
        }
    }
}
