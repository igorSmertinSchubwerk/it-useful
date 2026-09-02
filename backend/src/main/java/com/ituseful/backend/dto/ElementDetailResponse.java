package com.ituseful.backend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ElementDetailResponse(
		UUID id,
		String slug,
		List<ElementTranslationResponse> translations,
		List<ElementImageResponse> images,
		Instant createdAt,
		Instant updatedAt
) {
}
