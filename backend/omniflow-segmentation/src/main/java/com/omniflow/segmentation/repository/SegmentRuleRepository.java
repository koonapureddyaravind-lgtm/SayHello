package com.omniflow.segmentation.repository;

import com.omniflow.segmentation.domain.SegmentRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SegmentRuleRepository extends JpaRepository<SegmentRule, UUID> {

    List<SegmentRule> findBySegmentIdOrderBySortOrderAsc(UUID segmentId);

    @Modifying
    @Query("delete from SegmentRule r where r.segmentId = :segmentId")
    int deleteBySegmentId(@Param("segmentId") UUID segmentId);
}
