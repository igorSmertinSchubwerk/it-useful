package com.ituseful.backend.security;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

/**
 * Records sign-in outcomes for lockout and the security log. Logs name accounts
 * by id only, never by email address, password, or token.
 */
@Service
@Profile("server")
public class SignInAttempts {

	private static final Logger log = LoggerFactory.getLogger(SignInAttempts.class);

	private final AccountRepository accountRepository;
	private final Clock clock;

	public SignInAttempts(AccountRepository accountRepository, Clock clock) {
		this.accountRepository = accountRepository;
		this.clock = clock;
	}

	@Transactional
	public void recordFailure(String email) {
		Optional<Account> found = accountRepository.findByEmailIgnoreCase(email == null ? "" : email.trim());
		if (found.isEmpty()) {
			log.info("Sign-in failed for an unknown account");
			return;
		}
		Account account = found.get();
		Instant now = clock.instant();
		account.recordFailedSignIn(now);
		log.info("Sign-in failed for account {}", account.getId());
		if (account.isLockedAt(now)) {
			log.warn("Account {} locked for {} minutes after {} failed sign-ins",
					account.getId(), Account.LOCK_DURATION.toMinutes(), Account.MAX_FAILED_SIGN_INS);
		}
	}

	@Transactional
	public void recordSuccess(String email) {
		accountRepository.findByEmailIgnoreCase(email).ifPresent(Account::recordSuccessfulSignIn);
	}
}
