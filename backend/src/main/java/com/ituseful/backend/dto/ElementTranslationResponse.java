package com.ituseful.backend.dto;

import com.ituseful.backend.domain.LanguageCode;

public record ElementTranslationResponse(
		LanguageCode languageCode,
		String title,
		String content,
		String examples
) {
}
