package com.omniflow.integration.repository;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.integration.entity.ProviderAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProviderAccountRepository extends JpaRepository<ProviderAccount, UUID> {

    List<ProviderAccount> findByOrganizationIdOrderByChannelAscNameAsc(UUID organizationId);

    Optional<ProviderAccount> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Query("""
            select p from ProviderAccount p
            where p.organizationId = :organizationId
              and p.channel = :channel
              and p.defaultAccount = true
            """)
    Optional<ProviderAccount> findByOrganizationIdAndChannelAndIsDefaultTrue(
            @Param("organizationId") UUID organizationId,
            @Param("channel") Channel channel);

    Optional<ProviderAccount> findByOrganizationIdAndChannelAndName(UUID organizationId, Channel channel, String name);

    boolean existsByOrganizationIdAndChannelAndName(UUID organizationId, Channel channel, String name);

    List<ProviderAccount> findByChannel(Channel channel);

    List<ProviderAccount> findByOrganizationIdAndChannelOrderByNameAsc(UUID organizationId, Channel channel);

    @Query(value = """
            select * from provider_accounts
            where channel = 'WHATSAPP'
              and status = 'ACTIVE'
              and (config ->> 'phoneNumberId' = :phoneNumberId
                   or config ->> 'phone_number_id' = :phoneNumberId)
            order by is_default desc, created_at asc
            """, nativeQuery = true)
    List<ProviderAccount> findWhatsAppByPhoneNumberId(@Param("phoneNumberId") String phoneNumberId);
}
