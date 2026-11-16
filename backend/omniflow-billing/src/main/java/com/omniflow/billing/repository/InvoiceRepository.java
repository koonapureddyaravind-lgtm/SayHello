package com.omniflow.billing.repository;

import com.omniflow.billing.domain.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    List<Invoice> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    Optional<Invoice> findByOrganizationIdAndNumber(UUID organizationId, String number);

    boolean existsByNumber(String number);
}
