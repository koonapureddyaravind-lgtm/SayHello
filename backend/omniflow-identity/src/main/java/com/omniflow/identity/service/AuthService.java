package com.omniflow.identity.service;

import com.omniflow.common.domain.enums.OrganizationType;
import com.omniflow.common.domain.enums.UserStatus;
import com.omniflow.common.exception.ConflictException;
import com.omniflow.common.exception.UnauthorizedException;
import com.omniflow.common.port.OrganizationDirectory;
import com.omniflow.common.port.OrganizationProvisioner;
import com.omniflow.common.port.OrganizationSummary;
import com.omniflow.common.security.SecurityUtils;
import com.omniflow.identity.config.JwtProperties;
import com.omniflow.identity.dto.AuthResponse;
import com.omniflow.identity.dto.LoginRequest;
import com.omniflow.identity.dto.MeResponse;
import com.omniflow.identity.dto.OrganizationView;
import com.omniflow.identity.dto.RefreshTokenRequest;
import com.omniflow.identity.dto.RegisterRequest;
import com.omniflow.identity.dto.UserView;
import com.omniflow.identity.entity.RefreshToken;
import com.omniflow.identity.entity.User;
import com.omniflow.identity.repository.RefreshTokenRepository;
import com.omniflow.identity.repository.UserRepository;
import com.omniflow.identity.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final OrganizationProvisioner organizationProvisioner;
    private final OrganizationDirectory organizationDirectory;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       JwtProperties jwtProperties,
                       OrganizationProvisioner organizationProvisioner,
                       OrganizationDirectory organizationDirectory) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.organizationProvisioner = organizationProvisioner;
        this.organizationDirectory = organizationDirectory;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("EMAIL_TAKEN", "An account with this email already exists");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        OrganizationType type = request.organizationType() == null
                ? OrganizationType.BUSINESS
                : request.organizationType();
        organizationProvisioner.provisionOrganization(
                request.organizationName(), null, type, user.getId());

        Tokens tokens = issueTokens(user);
        return new AuthResponse(tokens.accessToken(), tokens.refreshToken(),
                toUserView(user), organizationViews(user.getId()));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UnauthorizedException("INVALID_CREDENTIALS", "Invalid email or password"));

        if (user.getStatus() != UserStatus.ACTIVE
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("INVALID_CREDENTIALS", "Invalid email or password");
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        Tokens tokens = issueTokens(user);
        return new AuthResponse(tokens.accessToken(), tokens.refreshToken(),
                toUserView(user), organizationViews(user.getId()));
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String rawToken = request.refreshToken();
        Claims claims;
        try {
            claims = jwtService.parse(rawToken);
        } catch (Exception ex) {
            throw new UnauthorizedException("INVALID_TOKEN", "Invalid refresh token");
        }

        if (!"refresh".equals(claims.get("typ", String.class))) {
            throw new UnauthorizedException("INVALID_TOKEN", "Invalid refresh token");
        }

        String tokenHash = jwtService.sha256Hex(rawToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new UnauthorizedException("INVALID_TOKEN", "Invalid refresh token"));

        Instant now = Instant.now();
        if (stored.getRevokedAt() != null || !stored.getExpiresAt().isAfter(now)) {
            throw new UnauthorizedException("INVALID_TOKEN", "Refresh token is no longer valid");
        }

        User user = userRepository.findByIdAndDeletedAtIsNull(stored.getUserId())
                .orElseThrow(() -> new UnauthorizedException("INVALID_TOKEN", "Refresh token is no longer valid"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new UnauthorizedException("INVALID_TOKEN", "Refresh token is no longer valid");
        }

        stored.setRevokedAt(now);
        refreshTokenRepository.save(stored);

        Tokens tokens = issueTokens(user);
        return new AuthResponse(tokens.accessToken(), tokens.refreshToken(), null, null);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(jwtService.sha256Hex(refreshToken))
                .ifPresent(token -> {
                    if (token.getRevokedAt() == null) {
                        token.setRevokedAt(Instant.now());
                        refreshTokenRepository.save(token);
                    }
                });
    }

    @Transactional(readOnly = true)
    public MeResponse me() {
        UUID userId = SecurityUtils.currentUserId();
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new UnauthorizedException("USER_NOT_FOUND", "User account no longer exists"));
        return new MeResponse(toUserView(user), organizationViews(userId));
    }

    private Tokens issueTokens(User user) {
        String accessToken = jwtService.issueAccess(user);
        String refreshToken = jwtService.issueRefresh(user);

        RefreshToken stored = new RefreshToken();
        stored.setUserId(user.getId());
        stored.setTokenHash(jwtService.sha256Hex(refreshToken));
        stored.setExpiresAt(Instant.now().plus(jwtProperties.getRefreshTtl()));
        refreshTokenRepository.save(stored);

        return new Tokens(accessToken, refreshToken);
    }

    private UserView toUserView(User user) {
        return new UserView(user.getId(), user.getEmail(), user.getFullName(),
                user.getStatus(), user.getCreatedAt());
    }

    private List<OrganizationView> organizationViews(UUID userId) {
        return organizationDirectory.organizationsForUser(userId).stream()
                .map(this::toOrganizationView)
                .toList();
    }

    private OrganizationView toOrganizationView(OrganizationSummary summary) {
        return new OrganizationView(summary.id(), summary.name(), summary.slug(),
                summary.type(), summary.role(), summary.status());
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private record Tokens(String accessToken, String refreshToken) {
    }
}
