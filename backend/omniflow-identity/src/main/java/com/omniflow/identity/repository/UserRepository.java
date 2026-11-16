package com.omniflow.identity.repository;

import com.omniflow.identity.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    @Query("select u from User u where lower(u.email) = lower(:email) and u.deletedAt is null")
    Optional<User> findByEmailIgnoreCase(@Param("email") String email);

    boolean existsByEmailIgnoreCase(String email);

    Optional<User> findByIdAndDeletedAtIsNull(UUID id);
}
