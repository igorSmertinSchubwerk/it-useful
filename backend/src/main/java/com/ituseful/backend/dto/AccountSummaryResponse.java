package com.ituseful.backend.dto;

import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;

import java.time.Instant;
import java.util.UUID;

public record AccountSummaryResponse(UUID id, String email, AccountRole role, AccountStatus status, Instant createdAt) {
}
