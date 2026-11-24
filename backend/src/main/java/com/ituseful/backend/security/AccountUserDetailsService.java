package com.ituseful.backend.security;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.repository.AccountRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

/**
 * Loads an account for sign-in. Only a confirmed account receives its role, so an
 * accepted account can sign in but cannot read or change anything yet.
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
				.authorities(authoritiesOf(account))
				.disabled(account.getStatus() == AccountStatus.DISABLED)
				.accountLocked(account.isLockedAt(clock.instant()))
				.build();
	}

	private static List<GrantedAuthority> authoritiesOf(Account account) {
		if (account.getStatus() != AccountStatus.CONFIRMED) {
			return List.of();
		}
		return List.of(new SimpleGrantedAuthority("ROLE_" + account.getRole().name()));
	}
}
