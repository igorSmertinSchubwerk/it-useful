package com.ituseful.backend.security;

import com.ituseful.backend.domain.Account;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

/**
 * Maps an account's current state to its authorities. Only a confirmed account
 * holds its role. An accepted account holds a marker that lets the API explain
 * why it is refused, and a disabled account holds nothing.
 */
public final class AccountAuthorities {

	public static final String PENDING = "ACCOUNT_PENDING";

	private AccountAuthorities() {
	}

	public static List<GrantedAuthority> of(Account account) {
		return switch (account.getStatus()) {
			case CONFIRMED -> List.of(new SimpleGrantedAuthority("ROLE_" + account.getRole().name()));
			case ACCEPTED -> List.of(new SimpleGrantedAuthority(PENDING));
			case DISABLED -> List.of();
		};
	}
}
