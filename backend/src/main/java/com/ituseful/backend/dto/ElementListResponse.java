package com.ituseful.backend.dto;

import com.ituseful.backend.domain.LanguageCode;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ElementListResponse(
		UUID id,
		String slug,
		Map<LanguageCode, String> titles,
		Instant updatedAt
) {
}
