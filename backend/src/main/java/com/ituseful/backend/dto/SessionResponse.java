package com.ituseful.backend.dto;

public record SessionResponse(
		boolean authenticated,
		String role,
		String login,
		CsrfTokenResponse csrf
) {
}
