package com.ituseful.backend.dto;

import com.ituseful.backend.domain.AccountRole;

import java.time.Instant;
import java.util.UUID;

/**
 * The link carries the token in its fragment, so browsers never send it to a
 * server and proxies never log it. It is shown once and never stored.
 */
public record InvitationResponse(
		UUID id,
		String email,
		AccountRole role,
		Instant expiresAt,
		String link,
		boolean emailSent
) {
}
