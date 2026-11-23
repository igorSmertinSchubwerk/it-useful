package com.ituseful.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordEncoderConfigurationTests {

	private final PasswordEncoder encoder = new PasswordEncoderConfiguration().passwordEncoder();

	@Test
	void ac12StoresPasswordsOnlyAsVerifiableBcryptHashes() {
		String hash = encoder.encode("correct horse battery staple");

		assertThat(hash).startsWith("{bcrypt}$2").doesNotContain("correct horse");
		assertThat(encoder.matches("correct horse battery staple", hash)).isTrue();
		assertThat(encoder.matches("correct horse battery stapler", hash)).isFalse();
	}
}
