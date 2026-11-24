package com.ituseful.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PasswordChangeRequest(
		@NotNull @Size(max = 1024) String currentPassword,
		@NotNull @Size(max = 1024) String newPassword
) {
}
