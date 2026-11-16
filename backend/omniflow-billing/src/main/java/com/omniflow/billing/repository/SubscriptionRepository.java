package com.omniflow.billing.repository;

import com.omniflow.billing.domain.Subscription;
import com.omniflow.common.domain.enums.SubscriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    Optional<Subscription> findByOrganizationId(UUID organizationId);

    List<Subscription> findByStatusIn(Collection<SubscriptionStatus> statuses);
}
