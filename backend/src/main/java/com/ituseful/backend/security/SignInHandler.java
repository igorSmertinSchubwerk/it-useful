package com.ituseful.backend.security;

import com.ituseful.backend.repository.AccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Answers the single-page app's sign-in request without redirects. Every failure
 * gets the same response, so it reveals neither whether an email address has an
 * account nor whether that account is locked or disabled.
 */
@Component
@Profile("server")
public class SignInHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

	static final String FAILURE_DETAIL = "The email address or password is incorrect";

	private final SignInAttempts signInAttempts;
	private final SecurityProblemWriter problemWriter;
	private final AccountRepository accountRepository;

	public SignInHandler(
			SignInAttempts signInAttempts,
			SecurityProblemWriter problemWriter,
			AccountRepository accountRepository
	) {
		this.signInAttempts = signInAttempts;
		this.problemWriter = problemWriter;
		this.accountRepository = accountRepository;
	}

	@Override
	public void onAuthenticationSuccess(
			HttpServletRequest request,
			HttpServletResponse response,
			Authentication authentication
	) {
		signInAttempts.recordSuccess(authentication.getName());
		accountRepository.findByEmailIgnoreCase(authentication.getName()).ifPresent(account ->
				SessionVersion.remember(request.getSession(), account.getSessionVersion()));
		response.setStatus(HttpStatus.NO_CONTENT.value());
	}

	@Override
	public void onAuthenticationFailure(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException exception
	) throws IOException {
		if (exception instanceof BadCredentialsException) {
			signInAttempts.recordFailure(request.getParameter("email"));
		}
		problemWriter.write(request, response, HttpStatus.UNAUTHORIZED, FAILURE_DETAIL, "sign_in_failed");
	}
}
