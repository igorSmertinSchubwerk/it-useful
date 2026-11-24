package com.ituseful.backend.dto;

import com.ituseful.backend.domain.AccountRole;

import java.time.Instant;
import java.util.UUID;

public record OpenInvitationResponse(UUID id, String email, AccountRole role, Instant expiresAt) {
}
