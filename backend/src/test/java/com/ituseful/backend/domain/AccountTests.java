package com.ituseful.backend.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountTests {

	private static final Instant START = Instant.parse("2026-11-23T10:00:00Z");

	private final Account account = new Account("ada@example.com", "{bcrypt}hash", AccountRole.USER,
			AccountStatus.CONFIRMED);

	@Test
	void ac14LocksForFifteenMinutesAfterFiveFailuresWithinFifteenMinutes() {
		failAtMinutes(0, 1, 2, 3);
		assertThat(account.isLockedAt(minutes(3))).isFalse();

		failAtMinutes(4);

		assertThat(account.isLockedAt(minutes(4))).isTrue();
		assertThat(account.isLockedAt(minutes(19).minusSeconds(1))).isTrue();
		assertThat(account.isLockedAt(minutes(19))).isFalse();
	}

	@Test
	void ac14StartsANewWindowWhenTheFirstFailureIsOlderThanFifteenMinutes() {
		failAtMinutes(0, 1, 2, 3);

		account.recordFailedSignIn(minutes(15).plusSeconds(1));

		assertThat(account.isLockedAt(minutes(15).plusSeconds(1))).isFalse();
	}

	@Test
	void ac14ForgetsEarlierFailuresAfterASuccessfulSignIn() {
		failAtMinutes(0, 1, 2, 3);

		account.recordSuccessfulSignIn();
		failAtMinutes(4, 5, 6, 7);

		assertThat(account.isLockedAt(minutes(7))).isFalse();
	}

	@Test
	void ac8ConfirmsAnAcceptedAccountButNoOtherState() {
		Account pending = new Account("p@example.com", "{bcrypt}hash", AccountRole.USER, AccountStatus.ACCEPTED);

		pending.confirm();

		assertThat(pending.getStatus()).isEqualTo(AccountStatus.CONFIRMED);
		assertThatThrownBy(pending::confirm).isInstanceOf(IllegalStateException.class);
	}

	private void failAtMinutes(int... offsets) {
		for (int offset : offsets) {
			account.recordFailedSignIn(minutes(offset));
		}
	}

	private static Instant minutes(int offset) {
		return START.plus(Duration.ofMinutes(offset));
	}
}
