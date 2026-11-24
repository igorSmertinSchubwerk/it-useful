package com.ituseful.backend.security;

import org.junit.jupiter.api.Test;

import java.security.SecureRandom;

import static org.assertj.core.api.Assertions.assertThat;

class InvitationTokensTests {

	private final InvitationTokens tokens = new InvitationTokens(new SecureRandom());

	@Test
	void ac5HashesTokensAsLowercaseSha256Hex() {
		assertThat(InvitationTokens.hash("abc"))
				.isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	}

	@Test
	void ac5GeneratesUrlSafeTokensWith256RandomBits() {
		String first = tokens.generate();
		String second = tokens.generate();

		assertThat(first).matches("[A-Za-z0-9_-]{43}");
		assertThat(second).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(first);
	}
}
