package com.ituseful.backend.security;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.repository.AccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Checks a signed-in session against the account on every request. A session
 * whose account is gone or whose session version is outdated ends at once.
 * Otherwise the authorities are recomputed, so a confirmation or role change
 * applies to open sessions. Registered only inside the security filter chain,
 * never as a bean.
 */
public class AccountAuthorityRefreshFilter extends OncePerRequestFilter {

	private final AccountRepository accountRepository;

	public AccountAuthorityRefreshFilter(AccountRepository accountRepository) {
		this.accountRepository = accountRepository;
	}

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain
	) throws ServletException, IOException {
		Authentication current = SecurityContextHolder.getContext().getAuthentication();
		if (current instanceof UsernamePasswordAuthenticationToken && current.isAuthenticated()) {
			Optional<Account> account = accountRepository.findByEmailIgnoreCase(current.getName());
			HttpSession session = request.getSession(false);
			if (account.isEmpty() || !SessionVersion.matches(session, account.get().getSessionVersion())) {
				if (session != null) {
					session.invalidate();
				}
				SecurityContextHolder.clearContext();
				filterChain.doFilter(request, response);
				return;
			}
			List<GrantedAuthority> fresh = AccountAuthorities.of(account.get());
			if (!Set.copyOf(fresh).equals(Set.copyOf(current.getAuthorities()))) {
				SecurityContext context = SecurityContextHolder.createEmptyContext();
				context.setAuthentication(
						UsernamePasswordAuthenticationToken.authenticated(current.getPrincipal(), null, fresh));
				SecurityContextHolder.setContext(context);
			}
		}
		filterChain.doFilter(request, response);
	}
}
