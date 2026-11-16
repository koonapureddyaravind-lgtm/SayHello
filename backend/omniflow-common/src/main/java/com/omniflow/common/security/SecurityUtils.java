package com.omniflow.common.security;

import com.omniflow.common.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Optional<AuthenticatedUser> currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public static UUID currentUserIdOrNull() {
        return currentUser().map(AuthenticatedUser::id).orElse(null);
    }

    public static UUID currentUserId() {
        return currentUser().map(AuthenticatedUser::id)
                .orElseThrow(() -> new UnauthorizedException("AUTHENTICATION_REQUIRED", "Authentication required"));
    }
}
