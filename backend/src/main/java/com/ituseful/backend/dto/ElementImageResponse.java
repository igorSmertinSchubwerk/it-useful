package com.ituseful.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record ElementImageResponse(
		UUID id,
		String fileName,
		String contentType,
		String altText,
		int displayOrder,
		Instant createdAt
) {
}
