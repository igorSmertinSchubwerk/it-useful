package com.ituseful.backend.controller;

import com.ituseful.backend.dto.CsrfTokenResponse;
import com.ituseful.backend.dto.SessionResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/session")
@Profile("server")
public class SessionController {

	@GetMapping
	public SessionResponse current(
			@AuthenticationPrincipal OAuth2User owner,
			CsrfToken csrfToken
	) {
		String login = owner.getAttribute("login");
		return new SessionResponse(
				true,
				"OWNER",
				login == null ? owner.getName() : login,
				new CsrfTokenResponse(csrfToken.getHeaderName(), csrfToken.getToken())
		);
	}
}
