package com.omniflow.common.port;

import java.util.Optional;
import java.util.UUID;

public interface UserDirectory {

    Optional<UserSummary> findByEmail(String email);

    Optional<UserSummary> findById(UUID id);

    /**
     * Creates a user with status INVITED and a random unusable password if absent.
     */
    UUID createInvitedUser(String email, String fullName);

    boolean existsByEmail(String email);
}
