package com.ituseful.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A single-use link an admin creates so a person can choose a new password.
 * Only the token's hash is stored. A newer link for the same account marks the
 * older ones as used.
 */
@Entity
@Table(name = "password_reset")
public class PasswordReset {

	public static final Duration VALIDITY = Duration.ofHours(24);

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "account_id", nullable = false)
	private UUID accountId;

	@Column(name = "token_hash", nullable = false, length = 64)
	private String tokenHash;

	@Column(name = "created_by", nullable = false)
	private UUID createdBy;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(name = "used_at")
	private Instant usedAt;

	protected PasswordReset() {
	}

	private PasswordReset(UUID accountId, String tokenHash, UUID createdBy, Instant now) {
		this.accountId = Objects.requireNonNull(accountId, "accountId");
		this.tokenHash = Element.requireText(tokenHash, "tokenHash");
		this.createdBy = Objects.requireNonNull(createdBy, "createdBy");
		this.createdAt = now;
		this.expiresAt = now.plus(VALIDITY);
	}

	public static PasswordReset create(UUID accountId, String tokenHash, UUID createdBy, Instant now) {
		return new PasswordReset(accountId, tokenHash, createdBy, now);
	}

	public boolean isUsableAt(Instant now) {
		return usedAt == null && now.isBefore(expiresAt);
	}

	public void markUsed(Instant now) {
		usedAt = now;
	}

	public UUID getId() {
		return id;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
