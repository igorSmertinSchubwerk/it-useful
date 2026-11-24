package com.ituseful.backend.controller;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.dto.CsrfTokenResponse;
import com.ituseful.backend.dto.SessionResponse;
import com.ituseful.backend.repository.AccountRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/session")
@Profile("server")
public class SessionController {

	private final AccountRepository accountRepository;

	public SessionController(AccountRepository accountRepository) {
		this.accountRepository = accountRepository;
	}

	@GetMapping
	public SessionResponse current(@AuthenticationPrincipal UserDetails principal, CsrfToken csrfToken) {
		Account account = accountRepository.findByEmailIgnoreCase(principal.getUsername()).orElseThrow();
		return new SessionResponse(account.getEmail(), account.getRole(), account.getStatus(), csrf(csrfToken));
	}

	/**
	 * Gives an anonymous browser the CSRF token it must send with the sign-in request.
	 */
	@GetMapping("/csrf")
	public CsrfTokenResponse csrf(CsrfToken csrfToken) {
		return new CsrfTokenResponse(csrfToken.getHeaderName(), csrfToken.getToken());
	}
}
