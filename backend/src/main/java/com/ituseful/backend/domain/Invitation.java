package com.ituseful.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * A single-use link that lets one email address set a password. Only the token's
 * hash is stored. An invitation without an inviting admin is the first-admin
 * bootstrap created by the operator command.
 */
@Entity
@Table(name = "invitation")
public class Invitation {

	public static final Duration VALIDITY = Duration.ofDays(7);

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "email", nullable = false, length = 254)
	private String email;

	@Enumerated(EnumType.STRING)
	@Column(name = "role", nullable = false, length = 16)
	private AccountRole role;

	@Column(name = "token_hash", nullable = false, length = 64)
	private String tokenHash;

	@Column(name = "created_by")
	private UUID createdBy;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(name = "accepted_at")
	private Instant acceptedAt;

	@Column(name = "revoked_at")
	private Instant revokedAt;

	protected Invitation() {
	}

	private Invitation(String email, AccountRole role, String tokenHash, UUID createdBy, Instant now) {
		this.email = Element.requireText(email, "email").toLowerCase(Locale.ROOT);
		this.role = Objects.requireNonNull(role, "role");
		this.tokenHash = Element.requireText(tokenHash, "tokenHash");
		this.createdBy = createdBy;
		this.createdAt = now;
		this.expiresAt = now.plus(VALIDITY);
	}

	public static Invitation create(String email, AccountRole role, String tokenHash, UUID createdBy, Instant now) {
		return new Invitation(email, role, tokenHash, createdBy, now);
	}

	public boolean isUsableAt(Instant now) {
		return acceptedAt == null && revokedAt == null && now.isBefore(expiresAt);
	}

	public void markAccepted(Instant now) {
		acceptedAt = now;
	}

	public void revoke(Instant now) {
		revokedAt = now;
	}

	public boolean isBootstrap() {
		return createdBy == null;
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public AccountRole getRole() {
		return role;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
