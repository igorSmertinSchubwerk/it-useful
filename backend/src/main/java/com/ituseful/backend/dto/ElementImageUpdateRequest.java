package com.ituseful.backend.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record ElementImageUpdateRequest(
		@Size(max = 500) String altText,
		@PositiveOrZero Integer displayOrder
) {
}
