package com.ituseful.backend.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class InvitationTests {

	private static final Instant CREATED = Instant.parse("2026-11-24T09:00:00Z");
	private static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");

	@Test
	void ac5StaysUsableForSevenDaysAfterCreation() {
		Invitation invitation = Invitation.create(" New.Person@Example.com ", AccountRole.USER, "hash", ADMIN_ID, CREATED);

		assertThat(invitation.getEmail()).isEqualTo("new.person@example.com");
		assertThat(invitation.isUsableAt(CREATED.plus(Duration.ofDays(7)).minusSeconds(1))).isTrue();
		assertThat(invitation.isUsableAt(CREATED.plus(Duration.ofDays(7)))).isFalse();
	}

	@Test
	void ac9IsNotUsableOnceAcceptedOrRevoked() {
		Invitation accepted = Invitation.create("a@example.com", AccountRole.USER, "hash-a", ADMIN_ID, CREATED);
		Invitation revoked = Invitation.create("r@example.com", AccountRole.USER, "hash-r", ADMIN_ID, CREATED);

		accepted.markAccepted(CREATED.plusSeconds(60));
		revoked.revoke(CREATED.plusSeconds(60));

		assertThat(accepted.isUsableAt(CREATED.plusSeconds(120))).isFalse();
		assertThat(revoked.isUsableAt(CREATED.plusSeconds(120))).isFalse();
	}

	@Test
	void ac19MarksInvitationsWithoutAnInvitingAdminAsTheFirstAdminBootstrap() {
		assertThat(Invitation.create("first@example.com", AccountRole.ADMIN, "hash", null, CREATED).isBootstrap())
				.isTrue();
		assertThat(Invitation.create("later@example.com", AccountRole.ADMIN, "hash", ADMIN_ID, CREATED).isBootstrap())
				.isFalse();
	}
}
