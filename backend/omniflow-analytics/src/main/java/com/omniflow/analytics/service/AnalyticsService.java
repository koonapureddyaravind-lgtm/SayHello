package com.omniflow.analytics.service;

import com.omniflow.analytics.dto.CampaignBreakdown;
import com.omniflow.analytics.dto.ChannelBreakdown;
import com.omniflow.analytics.dto.OverviewResponse;
import com.omniflow.analytics.dto.TimeSeriesPoint;
import com.omniflow.common.domain.enums.CampaignStatus;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.UsageMetric;
import com.omniflow.common.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Read-only reporting. Every query is parameterized and filtered by organization_id.
 */
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private static final int DEFAULT_DAYS = 30;

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public OverviewResponse overview(UUID organizationId, LocalDate from, LocalDate to) {
        Range range = range(from, to);
        Timestamp start = Timestamp.from(range.start());
        Timestamp end = Timestamp.from(range.endExclusive());

        long contactsTotal = count("""
                select count(*) from contacts
                where organization_id = ? and deleted_at is null
                """, organizationId);
        long contactsNew = count("""
                select count(*) from contacts
                where organization_id = ? and deleted_at is null
                  and created_at >= ? and created_at < ?
                """, organizationId, start, end);

        OverviewResponse.Messages messages = jdbcTemplate.queryForObject("""
                select
                  count(*) filter (where status in ('SENT','DELIVERED','READ')) as sent,
                  count(*) filter (where status in ('DELIVERED','READ')) as delivered,
                  count(*) filter (where status in ('FAILED','BOUNCED','REJECTED','UNDELIVERABLE')) as failed
                from messages
                where organization_id = ? and created_at >= ? and created_at < ?
                """, (rs, rowNum) -> {
            long sent = rs.getLong("sent");
            long delivered = rs.getLong("delivered");
            long failed = rs.getLong("failed");
            return new OverviewResponse.Messages(sent, delivered, failed, ratio(delivered, sent));
        }, organizationId, start, end);
        if (messages == null) {
            messages = new OverviewResponse.Messages(0, 0, 0, 0.0);
        }

        OverviewResponse.Campaigns campaigns = jdbcTemplate.queryForObject("""
                select
                  count(*) filter (where status in ('SCHEDULED','QUEUED','RUNNING','PAUSED')) as active,
                  count(*) filter (where status = 'COMPLETED') as completed
                from campaigns
                where organization_id = ? and deleted_at is null
                  and created_at >= ? and created_at < ?
                """, (rs, rowNum) -> new OverviewResponse.Campaigns(
                rs.getLong("active"), rs.getLong("completed")), organizationId, start, end);
        if (campaigns == null) {
            campaigns = new OverviewResponse.Campaigns(0, 0);
        }

        OverviewResponse.Inbox inbox = jdbcTemplate.queryForObject("""
                select
                  count(*) filter (where status = 'OPEN') as open_conversations,
                  coalesce(sum(unread_count), 0) as unread_messages
                from conversations
                where organization_id = ?
                """, (rs, rowNum) -> new OverviewResponse.Inbox(
                rs.getLong("open_conversations"), rs.getLong("unread_messages")), organizationId);
        if (inbox == null) {
            inbox = new OverviewResponse.Inbox(0, 0);
        }

        Map<UsageMetric, Long> usageByMetric = new EnumMap<>(UsageMetric.class);
        jdbcTemplate.query("""
                select metric, coalesce(sum(quantity), 0) as total
                from usage_records
                where organization_id = ? and period_start <= ? and period_end >= ?
                group by metric
                """, (rs, rowNum) -> {
            try {
                usageByMetric.put(UsageMetric.valueOf(rs.getString("metric")), rs.getLong("total"));
            } catch (IllegalArgumentException ignored) {
                // Unknown seeded metric value: skip rather than fail the report.
            }
            return null;
        }, organizationId, Date.valueOf(range.to()), Date.valueOf(range.from()));

        OverviewResponse.Usage usage = new OverviewResponse.Usage(
                usageByMetric.getOrDefault(UsageMetric.EMAIL_SENT, 0L),
                usageByMetric.getOrDefault(UsageMetric.WHATSAPP_SENT, 0L),
                usageByMetric.getOrDefault(UsageMetric.SMS_SENT, 0L));

        return new OverviewResponse(
                new OverviewResponse.Contacts(contactsTotal, contactsNew),
                messages, campaigns, inbox, usage);
    }

    @Transactional(readOnly = true)
    public List<TimeSeriesPoint> timeseries(UUID organizationId, String metric, LocalDate from, LocalDate to) {
        Range range = range(from, to);
        Timestamp start = Timestamp.from(range.start());
        Timestamp end = Timestamp.from(range.endExclusive());
        String normalized = metric == null || metric.isBlank()
                ? "sent"
                : metric.trim().toLowerCase(Locale.ROOT);

        String sql = switch (normalized) {
            case "sent" -> """
                    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as total
                    from messages
                    where organization_id = ? and created_at >= ? and created_at < ?
                      and status in ('SENT','DELIVERED','READ')
                    group by 1 order by 1
                    """;
            case "delivered" -> """
                    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as total
                    from messages
                    where organization_id = ? and created_at >= ? and created_at < ?
                      and status in ('DELIVERED','READ')
                    group by 1 order by 1
                    """;
            case "opened" -> """
                    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as total
                    from messages
                    where organization_id = ? and created_at >= ? and created_at < ?
                      and read_at is not null
                    group by 1 order by 1
                    """;
            case "failed" -> """
                    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as total
                    from messages
                    where organization_id = ? and created_at >= ? and created_at < ?
                      and status in ('FAILED','BOUNCED','REJECTED','UNDELIVERABLE')
                    group by 1 order by 1
                    """;
            default -> throw new BadRequestException("INVALID_METRIC",
                    "Supported metrics are sent, delivered, opened and failed");
        };

        return jdbcTemplate.query(sql, (rs, rowNum) ->
                new TimeSeriesPoint(rs.getString("day"), rs.getLong("total")), organizationId, start, end);
    }

    @Transactional(readOnly = true)
    public List<CampaignBreakdown> campaigns(UUID organizationId, LocalDate from, LocalDate to) {
        Range range = range(from, to);
        return jdbcTemplate.query("""
                select c.id as campaign_id,
                       c.name as name,
                       c.channel as channel,
                       c.status as status,
                       count(r.id) as total_recipients,
                       count(*) filter (where r.status in ('SENT','DELIVERED')) as sent,
                       count(*) filter (where r.status = 'DELIVERED') as delivered,
                       count(*) filter (where r.status = 'FAILED') as failed
                from campaigns c
                left join campaign_recipients r
                  on r.campaign_id = c.id and r.organization_id = c.organization_id
                where c.organization_id = ? and c.deleted_at is null
                  and c.created_at >= ? and c.created_at < ?
                group by c.id, c.name, c.channel, c.status
                order by c.created_at desc
                """, (rs, rowNum) -> new CampaignBreakdown(
                rs.getObject("campaign_id", UUID.class),
                rs.getString("name"),
                Channel.valueOf(rs.getString("channel")),
                CampaignStatus.valueOf(rs.getString("status")),
                rs.getLong("total_recipients"),
                rs.getLong("sent"),
                rs.getLong("delivered"),
                rs.getLong("failed")
        ), organizationId, Timestamp.from(range.start()), Timestamp.from(range.endExclusive()));
    }

    @Transactional(readOnly = true)
    public List<ChannelBreakdown> channels(UUID organizationId, LocalDate from, LocalDate to) {
        Range range = range(from, to);
        return jdbcTemplate.query("""
                select channel,
                       count(*) filter (where status in ('SENT','DELIVERED','READ')) as sent,
                       count(*) filter (where status in ('DELIVERED','READ')) as delivered,
                       count(*) filter (where status in ('FAILED','BOUNCED','REJECTED','UNDELIVERABLE')) as failed
                from messages
                where organization_id = ? and created_at >= ? and created_at < ?
                group by channel
                order by channel
                """, (rs, rowNum) -> {
            long sent = rs.getLong("sent");
            long delivered = rs.getLong("delivered");
            return new ChannelBreakdown(
                    Channel.valueOf(rs.getString("channel")),
                    sent,
                    delivered,
                    rs.getLong("failed"),
                    ratio(delivered, sent));
        }, organizationId, Timestamp.from(range.start()), Timestamp.from(range.endExclusive()));
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private Range range(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(DEFAULT_DAYS - 1L) : from;
        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "from must be on or before to");
        }
        return new Range(start, end,
                start.atStartOfDay(ZoneOffset.UTC).toInstant(),
                end.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    private static double ratio(long numerator, long denominator) {
        if (denominator <= 0) {
            return 0.0;
        }
        double value = (double) numerator / (double) denominator;
        return Math.round(value * 10000.0) / 10000.0;
    }

    private record Range(LocalDate from, LocalDate to, Instant start, Instant endExclusive) {
    }
}
