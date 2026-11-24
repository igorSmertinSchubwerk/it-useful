package com.ituseful.backend.security;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.repository.AccountRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/**
 * Loads an account for sign-in. Disabled and locked accounts cannot sign in.
 * {@link AccountAuthorities} decides what a signed-in account may do.
 */
@Component
@Profile("server")
public class AccountUserDetailsService implements UserDetailsService {

	private final AccountRepository accountRepository;
	private final Clock clock;

	public AccountUserDetailsService(AccountRepository accountRepository, Clock clock) {
		this.accountRepository = accountRepository;
		this.clock = clock;
	}

	@Override
	@Transactional(readOnly = true)
	public UserDetails loadUserByUsername(String email) {
		Account account = accountRepository.findByEmailIgnoreCase(email.trim())
				.orElseThrow(() -> new UsernameNotFoundException("Unknown account"));
		return User.withUsername(account.getEmail())
				.password(account.getPasswordHash())
				.authorities(AccountAuthorities.of(account))
				.disabled(account.getStatus() == AccountStatus.DISABLED)
				.accountLocked(account.isLockedAt(clock.instant()))
				.build();
	}
}
