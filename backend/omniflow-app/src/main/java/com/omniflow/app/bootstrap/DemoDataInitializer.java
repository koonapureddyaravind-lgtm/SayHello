package com.omniflow.app.bootstrap;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Seeds a complete, realistic demo workspace when {@code omniflow.demo.enabled=true}.
 * Idempotent: it exits as soon as the demo owner already exists.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "omniflow.demo", name = "enabled", havingValue = "true")
public class DemoDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);

    private static final UUID ROLE_OWNER = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ADMIN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MARKETING = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_AGENT = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID PLAN_FREE = UUID.fromString("20000000-0000-0000-0000-000000000005");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    @Value("${omniflow.demo.email:owner@omniflow.local}")
    private String ownerEmail;

    @Value("${omniflow.demo.password:OmniFlow123!}")
    private String ownerPassword;

    @Value("${omniflow.demo.organization:Acme Retail}")
    private String organizationName;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Integer existing = jdbc.query(
                "select count(*) from users where lower(email) = lower(?) and deleted_at is null",
                rs -> rs.next() ? rs.getInt(1) : 0,
                ownerEmail);
        if (existing != null && existing > 0) {
            log.info("Demo workspace already present for {}, skipping seed", ownerEmail);
            return;
        }

        log.info("Seeding demo workspace '{}' for {}", organizationName, ownerEmail);
        Random random = new Random(20261107L);
        Instant now = Instant.now();

        UUID orgId = UUID.randomUUID();
        String slug = slugify(organizationName) + "-" + UUID.randomUUID().toString().substring(0, 6);
        jdbc.update("""
                insert into organizations (id, name, slug, type, status, plan_id, timezone, settings)
                values (?, ?, ?, 'BUSINESS', 'ACTIVE', ?, 'UTC', ?::jsonb)
                """, orgId, organizationName, slug, PLAN_FREE, json(Map.of("onboarding", true, "demo", true)));

        String passwordHash = passwordEncoder.encode(ownerPassword);
        UUID ownerId = createUser(ownerEmail, passwordHash, "Ava Sterling", now.minus(120, ChronoUnit.DAYS));
        createMembership(orgId, ownerId, ROLE_OWNER);

        String domain = ownerEmail.contains("@") ? ownerEmail.substring(ownerEmail.indexOf('@')) : "@omniflow.local";
        UUID adminId = createUser("maya.chen" + domain, passwordHash, "Maya Chen", now.minus(95, ChronoUnit.DAYS));
        UUID marketingId = createUser("jordan.lee" + domain, passwordHash, "Jordan Lee", now.minus(70, ChronoUnit.DAYS));
        UUID agentId = createUser("priya.nair" + domain, passwordHash, "Priya Nair", now.minus(40, ChronoUnit.DAYS));
        createMembership(orgId, adminId, ROLE_ADMIN);
        createMembership(orgId, marketingId, ROLE_MARKETING);
        createMembership(orgId, agentId, ROLE_AGENT);

        jdbc.update("""
                insert into subscriptions (id, organization_id, plan_id, status, current_period_start,
                                           current_period_end, trial_ends_at)
                values (?, ?, ?, 'ACTIVE', now(), now() + interval '30 days', null)
                """, UUID.randomUUID(), orgId, PLAN_FREE);

        jdbc.update("""
                insert into provider_accounts (id, organization_id, channel, provider, name, status, config,
                                               from_address, from_name, is_default, last_verified_at)
                values (?, ?, 'EMAIL', 'SMTP', 'Demo SMTP', 'ACTIVE', ?::jsonb, 'noreply@omniflow.local',
                        'Acme Retail', true, now())
                """, UUID.randomUUID(), orgId,
                // Empty config inherits the shared SMTP_* relay like every workspace (no dev-only host).
                json(Map.of()));

        seedAttributeDefinitions(orgId);
        Map<String, UUID> tags = seedTags(orgId);
        List<ContactSeed> contacts = seedContacts(orgId, tags, random, now);
        seedConsent(orgId, contacts, now);
        seedSuppressions(orgId, contacts);
        UUID segmentId = seedSegment(orgId, ownerId, contacts);
        Map<String, UUID> templates = seedTemplates(orgId, ownerId, now);

        UUID welcomeCampaign = seedCampaign(orgId, ownerId, segmentId, templates.get("welcome"), "completed",
                "Welcome to Acme Retail", "EMAIL", "BROADCAST", "Your 15% welcome gift is inside",
                contacts.subList(0, Math.min(30, contacts.size())), random, now);
        UUID whatsappCampaign = seedCampaign(orgId, ownerId, segmentId, templates.get("whatsapp"), "running",
                "VIP early access drop", "WHATSAPP", "BROADCAST", null,
                contacts.subList(0, Math.min(20, contacts.size())), random, now);
        seedCampaign(orgId, ownerId, segmentId, templates.get("sms"), "draft",
                "Flash sale teaser", "SMS", "BROADCAST", null,
                contacts.subList(0, Math.min(12, contacts.size())), random, now, false);
        seedCampaign(orgId, ownerId, segmentId, templates.get("welcome"), "scheduled",
                "October loyalty digest", "EMAIL", "BROADCAST", "Your loyalty points just grew",
                List.of(), random, now, false);

        seedConversations(orgId, contacts, agentId, random, now);
        seedWorkflow(orgId, ownerId, contacts, random, now);
        seedUsage(orgId);
        seedAuditLogs(orgId, ownerId);

        log.info("Demo seed complete. Sign in with {} / {} in workspace '{}'", ownerEmail, ownerPassword, organizationName);
    }

    private UUID createUser(String email, String hash, String fullName, Instant createdAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into users (id, email, password_hash, full_name, status, email_verified_at,
                                   last_login_at, created_at, updated_at)
                values (?, ?, ?, ?, 'ACTIVE', now(), now(), ?, now())
                """, id, email, hash, fullName, Timestamp.from(createdAt));
        return id;
    }

    private void createMembership(UUID orgId, UUID userId, UUID roleId) {
        jdbc.update("""
                insert into memberships (id, organization_id, user_id, role_id, status, accepted_at)
                values (?, ?, ?, ?, 'ACTIVE', now())
                """, UUID.randomUUID(), orgId, userId, roleId);
    }

    private void seedAttributeDefinitions(UUID orgId) {
        Object[][] rows = {
                {"company", "Company", "STRING"},
                {"city", "City", "STRING"},
                {"lifetime_value", "Lifetime value", "NUMBER"},
                {"vip", "VIP", "BOOLEAN"}
        };
        for (Object[] row : rows) {
            jdbc.update("""
                    insert into contact_attributes (id, organization_id, key, label, data_type)
                    values (?, ?, ?, ?, ?)
                    on conflict (organization_id, key) do nothing
                    """, UUID.randomUUID(), orgId, row[0], row[1], row[2]);
        }
    }

    private Map<String, UUID> seedTags(UUID orgId) {
        Map<String, UUID> tags = new LinkedHashMap<>();
        String[][] definitions = {
                {"VIP", "#a855f7"},
                {"Newsletter", "#0ea5e9"},
                {"High intent", "#10b981"},
                {"Win-back", "#f59e0b"},
                {"Enterprise", "#f43f5e"}
        };
        for (String[] definition : definitions) {
            UUID id = UUID.randomUUID();
            jdbc.update("insert into tags (id, organization_id, name, color) values (?, ?, ?, ?) on conflict (organization_id, name) do nothing",
                    id, orgId, definition[0], definition[1]);
            UUID stored = jdbc.queryForObject("select id from tags where organization_id = ? and name = ?", UUID.class, orgId, definition[0]);
            tags.put(definition[0], stored != null ? stored : id);
        }
        return tags;
    }

    private List<ContactSeed> seedContacts(UUID orgId, Map<String, UUID> tags, Random random, Instant now) {
        String[][] people = {
                {"Sofia", "Reyes", "sofia.reyes", "+14155550111"},
                {"Marcus", "Bennett", "marcus.bennett", "+14155550112"},
                {"Lena", "Okafor", "lena.okafor", "+14155550113"},
                {"Theo", "Marchetti", "theo.marchetti", "+14155550114"},
                {"Amara", "Singh", "amara.singh", "+14155550115"},
                {"Noah", "Fischer", "noah.fischer", "+14155550116"},
                {"Isabel", "Costa", "isabel.costa", "+14155550117"},
                {"Kai", "Nakamura", "kai.nakamura", "+14155550118"},
                {"Nadia", "Petrov", "nadia.petrov", "+14155550119"},
                {"Owen", "Clarke", "owen.clarke", "+14155550120"},
                {"Priya", "Sharma", "priya.sharma", "+14155550121"},
                {"Elias", "Berg", "elias.berg", "+14155550122"},
                {"Maya", "Rossi", "maya.rossi", "+14155550123"},
                {"Jonah", "Hughes", "jonah.hughes", "+14155550124"},
                {"Clara", "Dubois", "clara.dubois", "+14155550125"},
                {"Ravi", "Patel", "ravi.patel", "+14155550126"},
                {"Elena", "Volkov", "elena.volkov", "+14155550127"},
                {"Sam", "Whitfield", "sam.whitfield", "+14155550128"},
                {"Aisha", "Bello", "aisha.bello", "+14155550129"},
                {"Diego", "Alvarez", "diego.alvarez", "+14155550130"},
                {"Hana", "Kim", "hana.kim", "+14155550131"},
                {"Lucas", "Moreau", "lucas.moreau", "+14155550132"},
                {"Zara", "Hussain", "zara.hussain", "+14155550133"},
                {"Felix", "Andersen", "felix.andersen", "+14155550134"},
                {"Grace", "Osei", "grace.osei", "+14155550135"},
                {"Milo", "Carter", "milo.carter", "+14155550136"},
                {"Ines", "Duarte", "ines.duarte", "+14155550137"},
                {"Arjun", "Mehta", "arjun.mehta", "+14155550138"}
        };
        String[] cities = {"San Francisco", "Austin", "London", "Berlin", "Lisbon", "Toronto", "New York", "Amsterdam"};
        String[] companies = {"Northwind", "Lumen Labs", "Cedar & Co", "Atlas Goods", "Brightline", "Wavelength", "Parcelly", "Solstice"};
        List<ContactSeed> result = new ArrayList<>();

        for (int index = 0; index < people.length; index++) {
            String[] person = people[index];
            UUID contactId = UUID.randomUUID();
            String email = person[2] + "@example.com";
            String status = index % 13 == 0 ? "UNSUBSCRIBED" : index % 17 == 0 ? "BOUNCED" : "ACTIVE";
            Map<String, Object> attributes = new LinkedHashMap<>();
            attributes.put("company", companies[index % companies.length]);
            attributes.put("city", cities[index % cities.length]);
            attributes.put("lifetime_value", 120 + random.nextInt(2400));
            attributes.put("vip", index % 5 == 0);
            jdbc.update("""
                    insert into contacts (id, organization_id, email, phone, first_name, last_name, status, source,
                                          attributes, last_engagement_at, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, now())
                    """, contactId, orgId, email, person[3], person[0], person[1], status,
                    index % 3 == 0 ? "IMPORT" : index % 3 == 1 ? "MANUAL" : "API",
                    json(attributes),
                    Timestamp.from(now.minus((index + 1) * 19L, ChronoUnit.HOURS)),
                    Timestamp.from(now.minus((index + 2) * 3L, ChronoUnit.DAYS)));

            List<UUID> tagIds = new ArrayList<>();
            if (index % 5 == 0) tagIds.add(tags.get("VIP"));
            if (index % 2 == 0) tagIds.add(tags.get("Newsletter"));
            if (index % 4 == 0) tagIds.add(tags.get("High intent"));
            if (index % 9 == 0) tagIds.add(tags.get("Enterprise"));
            if (index % 7 == 0) tagIds.add(tags.get("Win-back"));
            for (UUID tagId : tagIds) {
                jdbc.update("insert into contact_tags (contact_id, tag_id) values (?, ?) on conflict do nothing", contactId, tagId);
            }
            result.add(new ContactSeed(contactId, person[0], person[1], email, person[3], status));
        }
        return result;
    }

    private void seedConsent(UUID orgId, List<ContactSeed> contacts, Instant now) {
        String[] channels = {"EMAIL", "WHATSAPP", "SMS"};
        String[] sources = {"WEB_FORM", "IMPORT", "CHECKOUT"};
        for (int index = 0; index < contacts.size(); index++) {
            ContactSeed contact = contacts.get(index);
            boolean unsubscribed = "UNSUBSCRIBED".equals(contact.status());
            Instant grantedAt = now.minus(40L - (index % 25), ChronoUnit.DAYS);

            for (String channel : channels) {
                jdbc.update("""
                        insert into consent_records (organization_id, contact_id, channel, purpose, status, source,
                                                     ip_address, evidence, occurred_at, created_at)
                        values (?, ?, ?, 'MARKETING', 'GRANTED', ?, '203.0.113.24', ?::jsonb, ?, ?)
                        """, orgId, contact.id(), channel, sources[index % sources.length],
                        json(Map.of("form", channel.toLowerCase() + "-opt-in", "seeded", true)),
                        Timestamp.from(grantedAt), Timestamp.from(grantedAt));

                boolean emailOptOut = unsubscribed && "EMAIL".equals(channel);
                boolean whatsappOptOut = index == 7 && "WHATSAPP".equals(channel);
                boolean smsOptOut = index == 11 && "SMS".equals(channel);
                if (emailOptOut || whatsappOptOut || smsOptOut) {
                    Instant withdrawnAt = now.minus(2L + (index % 6), ChronoUnit.DAYS);
                    String source = emailOptOut ? "UNSUBSCRIBE_LINK"
                            : whatsappOptOut ? "WHATSAPP_STOP" : "SMS_STOP";
                    jdbc.update("""
                            insert into consent_records (organization_id, contact_id, channel, purpose, status, source,
                                                         ip_address, evidence, occurred_at, created_at)
                            values (?, ?, ?, 'MARKETING', 'WITHDRAWN', ?, '203.0.113.24', ?::jsonb, ?, ?)
                            """, orgId, contact.id(), channel, source,
                            json(Map.of("reason", "customer_opt_out", "seeded", true)),
                            Timestamp.from(withdrawnAt), Timestamp.from(withdrawnAt));
                }
            }

            Instant transactionalAt = now.minus(35L - (index % 20), ChronoUnit.DAYS);
            jdbc.update("""
                    insert into consent_records (organization_id, contact_id, channel, purpose, status, source,
                                                 ip_address, evidence, occurred_at, created_at)
                    values (?, ?, 'EMAIL', 'TRANSACTIONAL', 'GRANTED', 'CHECKOUT', '203.0.113.24', ?::jsonb, ?, ?)
                    """, orgId, contact.id(), json(Map.of("basis", "existing_customer", "seeded", true)),
                    Timestamp.from(transactionalAt), Timestamp.from(transactionalAt));
        }
    }

    private void seedSuppressions(UUID orgId, List<ContactSeed> contacts) {
        if (contacts.size() < 13) {
            return;
        }
        ContactSeed bounced = contacts.get(3);
        ContactSeed complained = contacts.get(9);
        ContactSeed invalidPhone = contacts.get(12);
        jdbc.update("""
                insert into suppression_records (organization_id, channel, email, reason, note)
                values (?, 'EMAIL', ?, 'HARD_BOUNCE', 'Mailbox does not exist')
                on conflict do nothing
                """, orgId, bounced.email());
        jdbc.update("""
                insert into suppression_records (organization_id, channel, email, reason, note)
                values (?, 'EMAIL', ?, 'COMPLAINT', 'Spam complaint received')
                on conflict do nothing
                """, orgId, complained.email());
        jdbc.update("""
                insert into suppression_records (organization_id, channel, phone, reason, note)
                values (?, 'SMS', ?, 'INVALID', 'Carrier reported invalid number')
                on conflict do nothing
                """, orgId, invalidPhone.phone());
    }

    private UUID seedSegment(UUID orgId, UUID ownerId, List<ContactSeed> contacts) {
        UUID segmentId = UUID.randomUUID();
        String rules = """
                [{"field":"status","operator":"eq","value":"ACTIVE","logicGroup":"AND"},
                 {"field":"attribute.lifetime_value","operator":"gte","value":250,"logicGroup":"AND"}]
                """;
        jdbc.update("""
                insert into segments (id, organization_id, name, description, type, match_type, rules, created_by)
                values (?, ?, 'High-value shoppers', 'Active contacts with lifetime value above $250', 'DYNAMIC', 'ALL', ?::jsonb, ?)
                """, segmentId, orgId, rules, ownerId);
        jdbc.update("""
                insert into segment_rules (id, segment_id, field, operator, value, logic_group, sort_order) values
                (?, ?, 'status', 'eq', '"ACTIVE"'::jsonb, 'AND', 0),
                (?, ?, 'attribute.lifetime_value', 'gte', '250'::jsonb, 'AND', 1)
                """, UUID.randomUUID(), segmentId, UUID.randomUUID(), segmentId);
        for (ContactSeed contact : contacts) {
            jdbc.update("insert into segment_members (segment_id, contact_id) values (?, ?) on conflict do nothing",
                    segmentId, contact.id());
        }
        return segmentId;
    }

    private Map<String, UUID> seedTemplates(UUID orgId, UUID ownerId, Instant now) {
        Map<String, UUID> templates = new LinkedHashMap<>();
        templates.put("welcome", createTemplate(orgId, ownerId, "Welcome series · Email", "EMAIL",
                "Welcome to Acme Retail, {{firstName}}",
                "Hi {{firstName}},\n\nWe're thrilled to have you. Here's 15% off your first order: WELCOME15.\n\nSee you inside,\nThe Acme team",
                "<div style=\"font-family:Inter,Arial,sans-serif;padding:32px\"><h1 style=\"color:#4f46e5\">Welcome, {{firstName}}!</h1><p>Here's 15% off your first order with code <strong>WELCOME15</strong>.</p><p>— The Acme team</p></div>",
                List.of("firstName", "lastName"), now.minus(18, ChronoUnit.DAYS)));
        templates.put("whatsapp", createTemplate(orgId, ownerId, "VIP early access · WhatsApp", "WHATSAPP",
                null,
                "Hi {{firstName}}! You're on the VIP list — early access opens in 2 hours. Reply YES and we'll hold a spot for you. 🎉",
                null, List.of("firstName"), now.minus(9, ChronoUnit.DAYS)));
        templates.put("sms", createTemplate(orgId, ownerId, "Flash sale teaser · SMS", "SMS",
                null,
                "Acme: {{firstName}}, flash sale starts tonight at 8pm. 40% off sitewide for 3 hours only. Reply STOP to opt out.",
                null, List.of("firstName"), now.minus(4, ChronoUnit.DAYS)));
        return templates;
    }

    private UUID createTemplate(UUID orgId, UUID ownerId, String name, String channel, String subject,
                                String body, String htmlBody, List<String> variables, Instant createdAt) {
        UUID id = UUID.randomUUID();
        String variablesJson;
        try {
            variablesJson = objectMapper.writeValueAsString(
                    variables.stream().map(variable -> Map.of("name", variable, "required", true)).toList());
        } catch (JsonProcessingException e) {
            variablesJson = "[]";
        }
        jdbc.update("""
                insert into templates (id, organization_id, name, channel, subject, body, html_body, variables,
                                       status, current_version, created_by, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'PUBLISHED', 1, ?, ?, now())
                """, id, orgId, name, channel, subject, body, htmlBody, variablesJson, ownerId,
                Timestamp.from(createdAt));
        jdbc.update("""
                insert into template_versions (id, template_id, version, subject, body, html_body, variables, created_by)
                values (?, ?, 1, ?, ?, ?, ?::jsonb, ?)
                """, UUID.randomUUID(), id, subject, body, htmlBody, variablesJson, ownerId);
        return id;
    }

    private UUID seedCampaign(UUID orgId, UUID ownerId, UUID segmentId, UUID templateId, String mode,
                              String name, String channel, String type, String subject,
                              List<ContactSeed> recipients, Random random, Instant now) {
        return seedCampaign(orgId, ownerId, segmentId, templateId, mode, name, channel, type, subject,
                recipients, random, now, true);
    }

    private UUID seedCampaign(UUID orgId, UUID ownerId, UUID segmentId, UUID templateId, String mode,
                              String name, String channel, String type, String subject,
                              List<ContactSeed> recipients, Random random, Instant now, boolean withMessages) {
        UUID campaignId = UUID.randomUUID();
        String status = switch (mode) {
            case "completed" -> "COMPLETED";
            case "running" -> "RUNNING";
            case "scheduled" -> "SCHEDULED";
            default -> "DRAFT";
        };
        Instant started = "completed".equals(mode) ? now.minus(12, ChronoUnit.DAYS)
                : "running".equals(mode) ? now.minus(2, ChronoUnit.DAYS) : null;
        Instant completed = "completed".equals(mode) ? now.minus(10, ChronoUnit.DAYS) : null;
        Instant scheduledAt = "scheduled".equals(mode) ? now.plus(3, ChronoUnit.DAYS) : null;

        jdbc.update("""
                insert into campaigns (id, organization_id, name, description, channel, type, template_id, segment_id,
                                       status, subject, content, sender_name, sender_address, scheduled_at,
                                       started_at, completed_at, created_by, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'Acme Retail', 'noreply@omniflow.local',
                        ?, ?, ?, ?, ?, now())
                """, campaignId, orgId, name,
                "Seeded demo campaign for " + channel.toLowerCase(), channel, type, templateId, segmentId, status,
                subject, json(Map.of("theme", "aurora", "preview", name)),
                scheduledAt == null ? null : Timestamp.from(scheduledAt),
                started == null ? null : Timestamp.from(started),
                completed == null ? null : Timestamp.from(completed),
                ownerId, Timestamp.from(now.minus(15, ChronoUnit.DAYS)));

        if (!withMessages) {
            return campaignId;
        }

        for (ContactSeed contact : recipients) {
            UUID messageId = UUID.randomUUID();
            String messageStatus = pickMessageStatus(mode, random);
            Instant occurred = started == null ? now : started.plus(random.nextInt(260), ChronoUnit.MINUTES);
            boolean sent = !"FAILED".equals(messageStatus);
            boolean delivered = "DELIVERED".equals(messageStatus) || "READ".equals(messageStatus);
            jdbc.update("""
                    insert into messages (id, organization_id, campaign_id, contact_id, channel, direction, provider,
                                          provider_message_id, idempotency_key, status, subject, body, to_address,
                                          from_address, error_code, error_message, sent_at, delivered_at, read_at,
                                          failed_at, metadata, created_at, updated_at)
                    values (?, ?, ?, ?, ?, 'OUTBOUND', ?, ?, ?, ?, ?, ?, ?, 'noreply@omniflow.local', ?, ?, ?, ?, ?, ?, ?::jsonb, ?, now())
                    """, messageId, orgId, campaignId, contact.id(), channel,
                    "EMAIL".equals(channel) ? "SMTP" : "WHATSAPP".equals(channel) ? "META_CLOUD" : "LOG",
                    "demo-" + messageId, "campaign:" + campaignId + ":contact:" + contact.id(), messageStatus,
                    subject, "Hi " + contact.firstName() + ", a quick update from " + organizationName + ".",
                    "EMAIL".equals(channel) ? contact.email() : contact.phone(),
                    sent ? null : "PROVIDER_ERROR",
                    sent ? null : "Seeded transient failure for demo purposes",
                    sent ? Timestamp.from(occurred) : null,
                    delivered ? Timestamp.from(occurred.plus(3, ChronoUnit.MINUTES)) : null,
                    "READ".equals(messageStatus) ? Timestamp.from(occurred.plus(18, ChronoUnit.MINUTES)) : null,
                    "FAILED".equals(messageStatus) ? Timestamp.from(occurred) : null,
                    json(Map.of("demo", true)),
                    Timestamp.from(occurred));

            // campaign_recipients.status does not include READ; a read message is delivered.
            String recipientStatus = switch (messageStatus) {
                case "DELIVERED", "READ" -> "DELIVERED";
                case "SENT" -> "SENT";
                case "FAILED" -> "FAILED";
                default -> "QUEUED";
            };
            jdbc.update("""
                    insert into campaign_recipients (id, organization_id, campaign_id, contact_id, status,
                                                    skip_reason, message_id)
                    values (?, ?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), orgId, campaignId, contact.id(), recipientStatus,
                    "SKIPPED".equals(recipientStatus) ? "No consent" : null, messageId);
        }
        return campaignId;
    }

    private String pickMessageStatus(String mode, Random random) {
        if ("running".equals(mode)) {
            int roll = random.nextInt(100);
            if (roll < 55) return "DELIVERED";
            if (roll < 70) return "READ";
            if (roll < 88) return "SENT";
            if (roll < 96) return "FAILED";
            return "QUEUED";
        }
        int roll = random.nextInt(100);
        if (roll < 62) return "DELIVERED";
        if (roll < 84) return "READ";
        if (roll < 94) return "SENT";
        return "FAILED";
    }

    private void seedConversations(UUID orgId, List<ContactSeed> contacts, UUID agentId, Random random, Instant now) {
        String[][] conversations = {
                {"WHATSAPP", "OPEN", "True! Can you hold the medium until Friday?"},
                {"EMAIL", "OPEN", "Thanks for the quick reply — the invoice is attached."},
                {"SMS", "PENDING", "STOP"},
                {"WHATSAPP", "OPEN", "Do you ship to Portugal?"},
                {"EMAIL", "RESOLVED", "Perfect, that fixed it. Thank you!"},
                {"WHATSAPP", "OPEN", "Is the VIP discount stackable with free shipping?"}
        };
        for (int index = 0; index < conversations.length && index < contacts.size(); index++) {
            ContactSeed contact = contacts.get(index);
            String channel = conversations[index][0];
            String status = conversations[index][1];
            String latestInbound = conversations[index][2];
            UUID conversationId = UUID.randomUUID();
            Instant lastMessageAt = now.minus((index + 1) * 37L, ChronoUnit.MINUTES);
            int unread = "OPEN".equals(status) ? 1 + random.nextInt(3) : 0;

            jdbc.update("""
                    insert into conversations (id, organization_id, contact_id, channel, status, subject,
                                               assignee_user_id, last_message_at, unread_count, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
                    """, conversationId, orgId, contact.id(), channel, status,
                    channel + " conversation with " + contact.firstName(), "OPEN".equals(status) ? agentId : null,
                    Timestamp.from(lastMessageAt), unread,
                    Timestamp.from(lastMessageAt.minus(3, ChronoUnit.DAYS)));

            String outboundBody = "Hi " + contact.firstName() + ", thanks for reaching out! Happy to help. "
                    + ("WHATSAPP".equals(channel) ? "I've reserved one for you." : "I've shared the details over email too.");
            jdbc.update("""
                    insert into conversation_messages (id, conversation_id, organization_id, direction, sender_type,
                                                       sender_user_id, body, attachments, status, created_at)
                    values (?, ?, ?, 'OUTBOUND', 'AGENT', ?, ?, '[]'::jsonb, 'SENT', ?)
                    """, UUID.randomUUID(), conversationId, orgId, agentId, outboundBody,
                    Timestamp.from(lastMessageAt.minus(2, ChronoUnit.HOURS)));
            jdbc.update("""
                    insert into conversation_messages (id, conversation_id, organization_id, direction, sender_type,
                                                       body, attachments, status, created_at)
                    values (?, ?, ?, 'INBOUND', 'CONTACT', ?, '[]'::jsonb, 'DELIVERED', ?)
                    """, UUID.randomUUID(), conversationId, orgId, latestInbound, Timestamp.from(lastMessageAt));

            if ("OPEN".equals(status) || "PENDING".equals(status)) {
                jdbc.update("""
                        insert into conversation_assignments (id, conversation_id, user_id, assigned_by, assigned_at)
                        values (?, ?, ?, ?, ?)
                        """, UUID.randomUUID(), conversationId, agentId, agentId, Timestamp.from(lastMessageAt.minus(3, ChronoUnit.DAYS)));
            }
        }
    }

    private void seedWorkflow(UUID orgId, UUID ownerId, List<ContactSeed> contacts, Random random, Instant now) {
        UUID workflowId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        String graph = """
                {"nodes":[
                  {"id":"trigger","type":"trigger","config":{},"position":{"x":0,"y":0}},
                  {"id":"welcome","type":"send_email","config":{"subject":"Welcome, {{firstName}}","body":"Here's 15% off your first order."},"position":{"x":0,"y":140}},
                  {"id":"pause","type":"wait","config":{"amount":1,"unit":"DAYS"},"position":{"x":0,"y":280}},
                  {"id":"check","type":"condition","config":{"field":"attributes.vip","operator":"eq","value":true},"position":{"x":0,"y":420}},
                  {"id":"tag","type":"add_tag","config":{"tagName":"High intent"},"position":{"x":-170,"y":560}},
                  {"id":"done","type":"end","config":{},"position":{"x":0,"y":700}}
                ],"edges":[
                  {"source":"trigger","target":"welcome","sourceHandle":null},
                  {"source":"welcome","target":"pause","sourceHandle":null},
                  {"source":"pause","target":"check","sourceHandle":null},
                  {"source":"check","target":"tag","sourceHandle":"true"},
                  {"source":"check","target":"done","sourceHandle":"false"},
                  {"source":"tag","target":"done","sourceHandle":null}
                ]}
                """;
        jdbc.update("""
                insert into workflows (id, organization_id, name, description, status, trigger_type, trigger_config,
                                       current_version, created_by, created_at, updated_at)
                values (?, ?, 'New customer welcome', 'Warm up every new contact with a welcome email, a short wait and a VIP tag.',
                        'ACTIVE', 'CONTACT_CREATED', '{}'::jsonb, 1, ?, ?, now())
                """, workflowId, orgId, ownerId, Timestamp.from(now.minus(22, ChronoUnit.DAYS)));
        jdbc.update("""
                insert into workflow_versions (id, workflow_id, version, graph, created_by, created_at, published_at)
                values (?, ?, 1, ?::jsonb, ?, ?, ?)
                """, versionId, workflowId, graph, ownerId,
                Timestamp.from(now.minus(20, ChronoUnit.DAYS)), Timestamp.from(now.minus(20, ChronoUnit.DAYS)));

        String[][] nodes = {
                {"trigger", "trigger", "0", "0"},
                {"welcome", "send_email", "0", "140"},
                {"pause", "wait", "0", "280"},
                {"check", "condition", "0", "420"},
                {"tag", "add_tag", "-170", "560"},
                {"done", "end", "0", "700"}
        };
        for (String[] node : nodes) {
            jdbc.update("""
                    insert into workflow_nodes (id, workflow_version_id, node_key, type, config, position_x, position_y)
                    values (?, ?, ?, ?, '{}'::jsonb, ?, ?)
                    """, UUID.randomUUID(), versionId, node[0], node[1], Double.parseDouble(node[2]), Double.parseDouble(node[3]));
        }

        String[] statuses = {"COMPLETED", "COMPLETED", "RUNNING", "WAITING"};
        for (int index = 0; index < statuses.length && index < contacts.size(); index++) {
            UUID executionId = UUID.randomUUID();
            ContactSeed contact = contacts.get(index);
            Instant started = now.minus((index + 1) * 2L, ChronoUnit.HOURS);
            Instant finished = "COMPLETED".equals(statuses[index]) ? started.plus(26, ChronoUnit.HOURS) : null;
            jdbc.update("""
                    insert into workflow_executions (id, organization_id, workflow_id, workflow_version_id, contact_id,
                                                     status, current_node_key, next_run_at, context, started_at,
                                                     finished_at, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, now())
                    """, executionId, orgId, workflowId, versionId, contact.id(), statuses[index],
                    "COMPLETED".equals(statuses[index]) ? "done" : "WAITING".equals(statuses[index]) ? "pause" : "welcome",
                    "WAITING".equals(statuses[index]) ? Timestamp.from(now.plus(6, ChronoUnit.HOURS)) : null,
                    json(Map.of("source", "demo")), Timestamp.from(started),
                    finished == null ? null : Timestamp.from(finished), Timestamp.from(started));

            jdbc.update("""
                    insert into workflow_execution_steps (id, execution_id, node_key, node_type, status, input, output,
                                                          started_at, finished_at)
                    values (?, ?, 'trigger', 'trigger', 'COMPLETED', '{}'::jsonb, ?::jsonb, ?, ?)
                    """, UUID.randomUUID(), executionId, json(Map.of("contactId", contact.id().toString())),
                    Timestamp.from(started), Timestamp.from(started.plusSeconds(1)));
            jdbc.update("""
                    insert into workflow_execution_steps (id, execution_id, node_key, node_type, status, input, output,
                                                          started_at, finished_at)
                    values (?, ?, 'welcome', 'send_email', 'COMPLETED', '{}'::jsonb, ?::jsonb, ?, ?)
                    """, UUID.randomUUID(), executionId, json(Map.of("messageId", UUID.randomUUID().toString())),
                    Timestamp.from(started.plusSeconds(2)), Timestamp.from(started.plusSeconds(3)));
        }
    }

    private void seedUsage(UUID orgId) {
        UUID[] metrics = null;
        String[][] definitions = {
                {"EMAIL_SENT", "8420", "900"},
                {"WHATSAPP_SENT", "2140", "4000"},
                {"SMS_SENT", "1260", "3500"}
        };
        for (String[] definition : definitions) {
            jdbc.update("""
                    insert into usage_records (id, organization_id, metric, quantity, unit_cost_micros,
                                               period_start, period_end, recorded_at)
                    values (?, ?, ?, ?, ?, date_trunc('month', current_date)::date,
                            (date_trunc('month', current_date) + interval '1 month - 1 day')::date, now())
                    """, UUID.randomUUID(), orgId, definition[0], Integer.parseInt(definition[1]),
                    Long.parseLong(definition[2]));
        }
    }

    private void seedAuditLogs(UUID orgId, UUID actorId) {
        Object[][] entries = {
                {"campaign.launch", "Campaign", "Welcome to Acme Retail", 12},
                {"contact.import", "Contact", "28 contacts imported", 26},
                {"workflow.publish", "Workflow", "New customer welcome v1", 40},
                {"integration.create", "ProviderAccount", "Demo SMTP", 55},
                {"member.invite", "Membership", "priya.nair", 70},
                {"template.publish", "Template", "Welcome series · Email", 96}
        };
        for (Object[] entry : entries) {
            jdbc.update("""
                    insert into audit_logs (id, organization_id, actor_user_id, action, entity_type, entity_id,
                                            after_state, ip_address, user_agent, created_at)
                    values (?, ?, ?, ?, ?, ?, ?::jsonb, '127.0.0.1', 'OmniFlow Demo Seeder', now() - (?::text || ' hours')::interval)
                    """, UUID.randomUUID(), orgId, actorId, entry[0], entry[1], entry[2],
                    json(Map.of("seeded", true)), entry[3]);
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String slugify(String value) {
        String slug = value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "demo-workspace" : slug;
    }

    private record ContactSeed(UUID id, String firstName, String lastName, String email, String phone, String status) {
    }
}
