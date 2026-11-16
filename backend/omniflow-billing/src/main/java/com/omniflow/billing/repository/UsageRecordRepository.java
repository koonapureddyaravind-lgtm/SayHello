package com.omniflow.billing.repository;

import com.omniflow.billing.domain.UsageRecord;
import com.omniflow.common.domain.enums.UsageMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface UsageRecordRepository extends JpaRepository<UsageRecord, UUID> {

    List<UsageRecord> findByOrganizationIdAndPeriodStartBetween(UUID organizationId,
                                                                LocalDate start,
                                                                LocalDate end);

    boolean existsByMessageIdAndMetric(UUID messageId, UsageMetric metric);

    @Query("""
            select u.metric as metric, coalesce(sum(u.quantity), 0) as total
            from UsageRecord u
            where u.organizationId = :organizationId
              and u.periodStart between :start and :end
            group by u.metric
            """)
    List<MetricTotal> aggregate(@Param("organizationId") UUID organizationId,
                                @Param("start") LocalDate start,
                                @Param("end") LocalDate end);

    interface MetricTotal {
        UsageMetric getMetric();

        Long getTotal();
    }
}
