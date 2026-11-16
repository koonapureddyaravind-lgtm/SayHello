package com.omniflow.crm.repository;

import com.omniflow.crm.domain.Contact;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContactRepository extends JpaRepository<Contact, UUID> {

    @Query("""
            select c from Contact c
            where c.organizationId = :orgId
              and c.deletedAt is null
              and (lower(coalesce(c.email, '')) like lower(concat('%', coalesce(:q, ''), '%'))
                   or lower(coalesce(c.firstName, '')) like lower(concat('%', coalesce(:q, ''), '%'))
                   or lower(coalesce(c.lastName, '')) like lower(concat('%', coalesce(:q, ''), '%'))
                   or coalesce(c.phone, '') like concat('%', coalesce(:q, ''), '%'))
              and (:status is null or c.status = :status)
            """)
    Page<Contact> search(@Param("orgId") UUID organizationId,
                         @Param("q") String q,
                         @Param("status") String status,
                         Pageable pageable);

    @Query("""
            select c from Contact c
            where c.organizationId = :orgId
              and c.deletedAt is null
              and c.id in :ids
              and (lower(coalesce(c.email, '')) like lower(concat('%', coalesce(:q, ''), '%'))
                   or lower(coalesce(c.firstName, '')) like lower(concat('%', coalesce(:q, ''), '%'))
                   or lower(coalesce(c.lastName, '')) like lower(concat('%', coalesce(:q, ''), '%'))
                   or coalesce(c.phone, '') like concat('%', coalesce(:q, ''), '%'))
              and (:status is null or c.status = :status)
            """)
    Page<Contact> searchByIds(@Param("orgId") UUID organizationId,
                              @Param("ids") Collection<UUID> ids,
                              @Param("q") String q,
                              @Param("status") String status,
                              Pageable pageable);

    Page<Contact> findByOrganizationIdAndIdInAndDeletedAtIsNull(UUID organizationId,
                                                                Collection<UUID> ids,
                                                                Pageable pageable);

    Optional<Contact> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);

    Optional<Contact> findByOrganizationIdAndEmailIgnoreCaseAndDeletedAtIsNull(UUID organizationId, String email);

    Optional<Contact> findByOrganizationIdAndPhoneAndDeletedAtIsNull(UUID organizationId, String phone);

    boolean existsByOrganizationIdAndEmailIgnoreCaseAndDeletedAtIsNull(UUID organizationId, String email);

    boolean existsByOrganizationIdAndPhoneAndDeletedAtIsNull(UUID organizationId, String phone);

    List<Contact> findByIdInAndOrganizationIdAndDeletedAtIsNull(Collection<UUID> ids, UUID organizationId);

    List<Contact> findByOrganizationIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID organizationId);

    long countByOrganizationIdAndDeletedAtIsNull(UUID organizationId);
}
