package com.omniflow.campaign.repository;

import com.omniflow.campaign.entity.CampaignRecipient;
import com.omniflow.common.domain.enums.RecipientStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CampaignRecipientRepository extends JpaRepository<CampaignRecipient, UUID> {

    boolean existsByCampaignIdAndContactId(UUID campaignId, UUID contactId);

    Page<CampaignRecipient> findByCampaignIdAndOrganizationId(UUID campaignId,
                                                             UUID organizationId,
                                                             Pageable pageable);

    Page<CampaignRecipient> findByCampaignIdAndOrganizationIdAndStatus(UUID campaignId,
                                                                       UUID organizationId,
                                                                       RecipientStatus status,
                                                                       Pageable pageable);

    long countByCampaignIdAndStatus(UUID campaignId, RecipientStatus status);

    long countByCampaignId(UUID campaignId);

    Page<CampaignRecipient> findByCampaignIdAndStatus(UUID campaignId,
                                                      RecipientStatus status,
                                                      Pageable pageable);
}
