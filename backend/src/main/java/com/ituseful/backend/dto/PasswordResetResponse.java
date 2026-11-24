package com.ituseful.backend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * The link carries the token in its fragment and is shown only once.
 */
public record PasswordResetResponse(UUID id, Instant expiresAt, String link) {
}
