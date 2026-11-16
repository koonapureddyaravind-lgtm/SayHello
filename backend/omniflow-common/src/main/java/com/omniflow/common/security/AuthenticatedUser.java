package com.omniflow.common.security;

import java.util.UUID;

/**
 * Authentication principal for JWT-authenticated requests.
 */
public record AuthenticatedUser(UUID id, String email, String name) {
}
