package com.omniflow.billing.repository;

import com.omniflow.billing.domain.Plan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanRepository extends JpaRepository<Plan, UUID> {

    Optional<Plan> findByCode(String code);

    @Query("select p from Plan p where p.isPublic = true order by p.sortOrder asc")
    List<Plan> findByIsPublicTrueOrderBySortOrder();

    @Query("select p from Plan p order by p.sortOrder asc")
    List<Plan> findAllOrderBySortOrder();
}
