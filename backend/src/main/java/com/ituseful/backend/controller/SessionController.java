package com.ituseful.backend.controller;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.dto.CsrfTokenResponse;
import com.ituseful.backend.dto.PasswordChangeRequest;
import com.ituseful.backend.dto.SessionResponse;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.security.SessionVersion;
import com.ituseful.backend.service.AccountPasswordService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/session")
@Profile("server")
public class SessionController {

	private final AccountRepository accountRepository;
	private final AccountPasswordService passwords;

	public SessionController(AccountRepository accountRepository, AccountPasswordService passwords) {
		this.accountRepository = accountRepository;
		this.passwords = passwords;
	}

	@GetMapping
	public SessionResponse current(@AuthenticationPrincipal UserDetails principal, CsrfToken csrfToken) {
		Account account = accountRepository.findByEmailIgnoreCase(principal.getUsername()).orElseThrow();
		return new SessionResponse(account.getEmail(), account.getRole(), account.getStatus(), csrf(csrfToken));
	}

	/**
	 * Changes the signed-in person's password. This session survives with a new
	 * id, and every other session of the account ends.
	 */
	@PostMapping("/password")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void changePassword(
			@Valid @RequestBody PasswordChangeRequest request,
			@AuthenticationPrincipal UserDetails principal,
			HttpServletRequest httpRequest
	) {
		passwords.changeOwn(principal.getUsername(), request);
		httpRequest.changeSessionId();
		SessionVersion.remember(httpRequest.getSession(), passwords.sessionVersionOf(principal.getUsername()));
	}

	/**
	 * Gives an anonymous browser the CSRF token it must send with the sign-in request.
	 */
	@GetMapping("/csrf")
	public CsrfTokenResponse csrf(CsrfToken csrfToken) {
		return new CsrfTokenResponse(csrfToken.getHeaderName(), csrfToken.getToken());
	}
}
