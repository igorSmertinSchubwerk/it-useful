package com.ituseful.backend.security;

import com.ituseful.backend.repository.AccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Set;

/**
 * Recomputes a signed-in account's authorities from the database on every
 * request, so a confirmation or role change applies to sessions that are already
 * open. Registered only inside the security filter chain, never as a bean.
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
			List<GrantedAuthority> fresh = accountRepository.findByEmailIgnoreCase(current.getName())
					.map(AccountAuthorities::of)
					.orElse(List.of());
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
