package com.omniflow.consent.service;

import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.port.SuppressionChecker;
import com.omniflow.consent.repository.SuppressionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SuppressionCheckerImpl implements SuppressionChecker {

    private final SuppressionRecordRepository suppressionRecordRepository;

    @Override
    @Transactional(readOnly = true)
    public boolean isSuppressed(UUID organizationId, String email, String phone, Channel channel) {
        if ((email == null || email.isBlank()) && (phone == null || phone.isBlank())) {
            return false;
        }
        return suppressionRecordRepository.countActive(
                organizationId,
                email == null ? null : email.trim(),
                phone == null ? null : phone.trim(),
                channel,
                Instant.now()) > 0;
    }
}
