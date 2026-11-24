package com.ituseful.backend.dto;

import com.ituseful.backend.domain.AccountRole;
import jakarta.validation.constraints.NotNull;

public record RoleChangeRequest(@NotNull AccountRole role) {
}
