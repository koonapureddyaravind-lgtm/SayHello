package com.omniflow.consent.service;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.ConsentStatus;
import com.omniflow.common.port.ConsentChecker;
import com.omniflow.consent.domain.ConsentRecord;
import com.omniflow.consent.repository.ConsentRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConsentCheckerImpl implements ConsentChecker {

    private final ConsentRecordRepository consentRecordRepository;

    @Override
    public boolean canSend(UUID organizationId, UUID contactId, Channel channel, ConsentPurpose purpose) {
        List<ConsentRecord> latest = consentRecordRepository.latestFor(
                organizationId, contactId, channel, purpose, PageRequest.of(0, 1));
        if (!latest.isEmpty()) {
            return latest.get(0).getStatus() == ConsentStatus.GRANTED;
        }

        if (purpose == ConsentPurpose.MARKETING) {
            return false;
        }

        // Transactional fallback: a denial/withdrawal against any purpose on this channel blocks sending.
        List<ConsentRecord> anyPurpose = consentRecordRepository.latestForChannel(
                organizationId, contactId, channel, PageRequest.of(0, 1));
        if (anyPurpose.isEmpty()) {
            return true;
        }
        ConsentStatus status = anyPurpose.get(0).getStatus();
        return status != ConsentStatus.DENIED && status != ConsentStatus.WITHDRAWN;
    }
}
