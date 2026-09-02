package com.ituseful.backend.dto;

import com.ituseful.backend.domain.LanguageCode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ElementTranslationRequest(
		@NotNull LanguageCode languageCode,
		@NotBlank @Size(max = 255) String title,
		@NotBlank @Size(max = 50_000) String content,
		@Size(max = 50_000) String examples
) {
}
