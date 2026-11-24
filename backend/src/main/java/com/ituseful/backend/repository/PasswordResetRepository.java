package com.ituseful.backend.repository;

import com.ituseful.backend.domain.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, UUID> {

	Optional<PasswordReset> findByTokenHash(String tokenHash);

	List<PasswordReset> findAllByAccountIdAndUsedAtIsNull(UUID accountId);
}
