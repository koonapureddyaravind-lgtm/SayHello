package com.omniflow.identity.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.common.api.ApiError;
import com.omniflow.common.api.ApiResponse;
import com.omniflow.common.port.MembershipChecker;
import com.omniflow.common.security.AuthenticatedUser;
import com.omniflow.common.security.SecurityUtils;
import com.omniflow.common.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Validates the active workspace header and exposes it through {@link TenantContext}.
 */
@Component
public class TenantContextFilter extends OncePerRequestFilter {

    private static final String ORGANIZATION_HEADER = "X-Organization-Id";

    private final MembershipChecker membershipChecker;
    private final ObjectMapper objectMapper;

    public TenantContextFilter(MembershipChecker membershipChecker, ObjectMapper objectMapper) {
        this.membershipChecker = membershipChecker;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String header = request.getHeader(ORGANIZATION_HEADER);
            if (header == null || header.isBlank()) {
                filterChain.doFilter(request, response);
                return;
            }

            AuthenticatedUser user = SecurityUtils.currentUser().orElse(null);
            if (user == null) {
                // The security chain will reject the request with 401.
                filterChain.doFilter(request, response);
                return;
            }

            UUID organizationId;
            try {
                organizationId = UUID.fromString(header.trim());
            } catch (IllegalArgumentException ex) {
                writeError(response, HttpStatus.BAD_REQUEST, "INVALID_ORGANIZATION_HEADER",
                        "The X-Organization-Id header must be a valid UUID");
                return;
            }

            if (!membershipChecker.isMember(organizationId, user.id())) {
                writeError(response, HttpStatus.FORBIDDEN, "NOT_A_MEMBER",
                        "You are not a member of this organization");
                return;
            }

            TenantContext.setOrganizationId(organizationId);
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private void writeError(HttpServletResponse response,
                            HttpStatus status,
                            String code,
                            String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(ApiError.of(code, message)));
    }
}
