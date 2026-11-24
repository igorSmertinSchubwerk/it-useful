package com.ituseful.backend.service;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.PasswordReset;
import com.ituseful.backend.dto.CompletePasswordResetRequest;
import com.ituseful.backend.dto.PasswordChangeRequest;
import com.ituseful.backend.dto.PasswordResetResponse;
import com.ituseful.backend.exception.AccountNotFoundException;
import com.ituseful.backend.exception.CurrentPasswordIncorrectException;
import com.ituseful.backend.exception.PasswordRejectedException;
import com.ituseful.backend.exception.PasswordResetInvalidException;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.repository.PasswordResetRepository;
import com.ituseful.backend.security.InvitationTokens;
import com.ituseful.backend.security.PasswordPolicy;
import com.ituseful.backend.security.ServerSecurityProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Changes passwords, either by the signed-in person or through an admin's reset
 * link. Every change ends the account's other sessions. Logs name accounts and
 * resets by id only.
 */
@Service
@Profile("server")
public class AccountPasswordService {

	private static final Logger log = LoggerFactory.getLogger(AccountPasswordService.class);

	private final AccountRepository accountRepository;
	private final PasswordResetRepository resetRepository;
	private final PasswordPolicy passwordPolicy;
	private final PasswordEncoder passwordEncoder;
	private final InvitationTokens tokens;
	private final ServerSecurityProperties properties;
	private final Clock clock;

	public AccountPasswordService(
			AccountRepository accountRepository,
			PasswordResetRepository resetRepository,
			PasswordPolicy passwordPolicy,
			PasswordEncoder passwordEncoder,
			InvitationTokens tokens,
			ServerSecurityProperties properties,
			Clock clock
	) {
		this.accountRepository = accountRepository;
		this.resetRepository = resetRepository;
		this.passwordPolicy = passwordPolicy;
		this.passwordEncoder = passwordEncoder;
		this.tokens = tokens;
		this.properties = properties;
		this.clock = clock;
	}

	@Transactional
	public void changeOwn(String email, PasswordChangeRequest request) {
		Account account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
		if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash())) {
			throw new CurrentPasswordIncorrectException();
		}
		replacePassword(account, request.newPassword());
		log.info("Account {} changed its password", account.getId());
	}

	@Transactional(readOnly = true)
	public int sessionVersionOf(String email) {
		return accountRepository.findByEmailIgnoreCase(email).orElseThrow().getSessionVersion();
	}

	@Transactional
	public PasswordResetResponse createReset(String adminEmail, UUID accountId) {
		UUID adminId = accountRepository.findByEmailIgnoreCase(adminEmail).orElseThrow().getId();
		Account account = accountRepository.findById(accountId).orElseThrow(AccountNotFoundException::new);
		Instant now = clock.instant();
		resetRepository.findAllByAccountIdAndUsedAtIsNull(account.getId()).forEach(older -> older.markUsed(now));
		String token = tokens.generate();
		PasswordReset reset = resetRepository.saveAndFlush(
				PasswordReset.create(account.getId(), InvitationTokens.hash(token), adminId, now));
		log.info("Admin {} created password reset {} for account {}", adminId, reset.getId(), account.getId());
		return new PasswordResetResponse(reset.getId(), reset.getExpiresAt(),
				properties.publicOrigin() + "/reset-password#" + token);
	}

	@Transactional
	public void completeReset(CompletePasswordResetRequest request) {
		Instant now = clock.instant();
		PasswordReset reset = resetRepository.findByTokenHash(InvitationTokens.hash(request.token()))
				.filter(candidate -> candidate.isUsableAt(now))
				.orElseThrow(PasswordResetInvalidException::new);
		Account account = accountRepository.findById(reset.getAccountId())
				.orElseThrow(PasswordResetInvalidException::new);
		replacePassword(account, request.password());
		reset.markUsed(now);
		log.info("Password reset {} used by account {}", reset.getId(), account.getId());
	}

	private void replacePassword(Account account, String newPassword) {
		passwordPolicy.check(account.getEmail(), newPassword).ifPresent(violation -> {
			throw new PasswordRejectedException(violation);
		});
		account.changePassword(passwordEncoder.encode(newPassword));
	}
}
