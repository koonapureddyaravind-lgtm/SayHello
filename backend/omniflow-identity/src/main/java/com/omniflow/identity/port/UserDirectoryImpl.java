package com.omniflow.identity.port;

import com.omniflow.common.domain.enums.UserStatus;
import com.omniflow.common.port.UserDirectory;
import com.omniflow.common.port.UserSummary;
import com.omniflow.identity.entity.User;
import com.omniflow.identity.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserDirectoryImpl implements UserDirectory {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserDirectoryImpl(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public Optional<UserSummary> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .map(this::toSummary);
    }

    @Override
    public Optional<UserSummary> findById(UUID id) {
        return userRepository.findByIdAndDeletedAtIsNull(id)
                .map(this::toSummary);
    }

    @Override
    @Transactional
    public UUID createInvitedUser(String email, String fullName) {
        String normalizedEmail = normalizeEmail(email);
        Optional<User> existing = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existing.isPresent()) {
            return existing.get().getId();
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setFullName(fullName);
        user.setStatus(UserStatus.INVITED);
        return userRepository.save(user).getId();
    }

    @Override
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmailIgnoreCase(normalizeEmail(email));
    }

    private UserSummary toSummary(User user) {
        return new UserSummary(user.getId(), user.getEmail(), user.getFullName(),
                user.getStatus() == null ? null : user.getStatus().name());
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
