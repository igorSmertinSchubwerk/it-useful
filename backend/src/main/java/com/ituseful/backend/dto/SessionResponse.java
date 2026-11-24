package com.ituseful.backend.dto;

import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;

public record SessionResponse(
		String email,
		AccountRole role,
		AccountStatus status,
		CsrfTokenResponse csrf
) {
}
