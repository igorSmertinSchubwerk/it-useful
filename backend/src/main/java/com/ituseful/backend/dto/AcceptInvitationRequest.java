package com.ituseful.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AcceptInvitationRequest(
		@NotBlank @Size(max = 100) String token,
		@NotNull @Size(max = 1024) String password
) {
}
