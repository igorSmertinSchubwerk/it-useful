package com.ituseful.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ElementWriteRequest(
		@NotBlank
		@Size(max = 160)
		@Pattern(
				regexp = "[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*",
				message = "must contain only letters, numbers, and single hyphens"
		)
		String slug,
		@NotNull @CompleteTranslations List<@NotNull @Valid ElementTranslationRequest> translations
) {
}
