package com.ituseful.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * A person who can sign in to the server variant, identified by a lowercased
 * email address. The password is stored only as a hash.
 */
@Entity
@Table(name = "account")
public class Account {

	public static final int MAX_FAILED_SIGN_INS = 5;
	public static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
	public static final Duration LOCK_DURATION = Duration.ofMinutes(15);

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "email", nullable = false, length = 254)
	private String email;

	@Column(name = "password_hash", nullable = false, length = 255)
	private String passwordHash;

	@Enumerated(EnumType.STRING)
	@Column(name = "role", nullable = false, length = 16)
	private AccountRole role;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 16)
	private AccountStatus status;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "failed_sign_ins", nullable = false)
	private int failedSignIns;

	@Column(name = "failure_window_started_at")
	private Instant failureWindowStartedAt;

	@Column(name = "locked_until")
	private Instant lockedUntil;

	@Column(name = "session_version", nullable = false)
	private int sessionVersion;

	protected Account() {
	}

	public Account(String email, String passwordHash, AccountRole role, AccountStatus status) {
		this.email = Element.requireText(email, "email").toLowerCase(Locale.ROOT);
		this.passwordHash = Element.requireText(passwordHash, "passwordHash");
		this.role = Objects.requireNonNull(role, "role");
		this.status = Objects.requireNonNull(status, "status");
	}

	@PrePersist
	void createTimestamp() {
		createdAt = Instant.now();
	}

	/**
	 * Counts a wrong password. The fifth failure within one window locks the
	 * account and starts a fresh count for the time after the lock.
	 */
	public void recordFailedSignIn(Instant now) {
		if (failureWindowStartedAt == null || now.isAfter(failureWindowStartedAt.plus(FAILURE_WINDOW))) {
			failureWindowStartedAt = now;
			failedSignIns = 0;
		}
		failedSignIns++;
		if (failedSignIns >= MAX_FAILED_SIGN_INS) {
			lockedUntil = now.plus(LOCK_DURATION);
			failedSignIns = 0;
			failureWindowStartedAt = null;
		}
	}

	public void confirm() {
		if (status != AccountStatus.ACCEPTED) {
			throw new IllegalStateException("Only an accepted account can be confirmed");
		}
		status = AccountStatus.CONFIRMED;
	}

	/**
	 * Replaces the password, ends every other session, and lifts a lockout.
	 */
	public void changePassword(String newPasswordHash) {
		passwordHash = Element.requireText(newPasswordHash, "newPasswordHash");
		sessionVersion++;
		recordSuccessfulSignIn();
	}

	public void changeRole(AccountRole newRole) {
		role = Objects.requireNonNull(newRole, "newRole");
	}

	public void disable() {
		status = AccountStatus.DISABLED;
		sessionVersion++;
	}

	public void enable() {
		if (status != AccountStatus.DISABLED) {
			throw new IllegalStateException("Only a disabled account can be enabled");
		}
		status = AccountStatus.CONFIRMED;
	}

	public int getSessionVersion() {
		return sessionVersion;
	}

	public void recordSuccessfulSignIn() {
		failedSignIns = 0;
		failureWindowStartedAt = null;
		lockedUntil = null;
	}

	public boolean isLockedAt(Instant now) {
		return lockedUntil != null && now.isBefore(lockedUntil);
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public AccountRole getRole() {
		return role;
	}

	public AccountStatus getStatus() {
		return status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
