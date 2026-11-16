package com.omniflow.crm.repository;

import com.omniflow.crm.domain.ContactActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ContactActivityRepository extends JpaRepository<ContactActivity, UUID> {

    Page<ContactActivity> findByContactIdAndOrganizationIdOrderByOccurredAtDesc(
            UUID contactId, UUID organizationId, Pageable pageable);
}
