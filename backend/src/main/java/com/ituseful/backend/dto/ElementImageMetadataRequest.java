package com.ituseful.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record ElementImageMetadataRequest(
		@NotBlank
		@Pattern(regexp = "image/(?:jpeg|png|webp)", message = "must be image/jpeg, image/png, or image/webp")
		String contentType,
		@Positive @Max(10 * 1024 * 1024) long sizeBytes,
		@Size(max = 500) String altText,
		@PositiveOrZero int displayOrder
) {
}
