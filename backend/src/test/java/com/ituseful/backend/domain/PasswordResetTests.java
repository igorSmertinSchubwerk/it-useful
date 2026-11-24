package com.ituseful.backend.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetTests {

	private static final Instant CREATED = Instant.parse("2026-11-24T09:00:00Z");
	private static final UUID ACCOUNT_ID = UUID.fromString("00000000-0000-0000-0000-0000000000d1");
	private static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");

	@Test
	void ac16StaysUsableFor24Hours() {
		PasswordReset reset = PasswordReset.create(ACCOUNT_ID, "hash", ADMIN_ID, CREATED);

		assertThat(reset.isUsableAt(CREATED.plus(Duration.ofHours(24)).minusSeconds(1))).isTrue();
		assertThat(reset.isUsableAt(CREATED.plus(Duration.ofHours(24)))).isFalse();
	}

	@Test
	void ac16IsSingleUse() {
		PasswordReset reset = PasswordReset.create(ACCOUNT_ID, "hash", ADMIN_ID, CREATED);

		reset.markUsed(CREATED.plusSeconds(60));

		assertThat(reset.isUsableAt(CREATED.plusSeconds(120))).isFalse();
	}
}
