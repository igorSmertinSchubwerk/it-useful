package com.ituseful.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTests {

	private static final String EMAIL = "Ada.Lovelace@example.com";

	private final PasswordPolicy policy = PasswordPolicy.withBundledCommonPasswords();

	@Test
	void ac11RejectsPasswordsShorterThanTwelveCharacters() {
		assertThat(policy.check(EMAIL, "elevenchars")).contains(PasswordViolation.TOO_SHORT);
	}

	@Test
	void ac11CountsUnicodeCharactersInsteadOfUtf16Units() {
		String elevenEmoji = "🔑".repeat(11);

		assertThat(policy.check(EMAIL, elevenEmoji)).contains(PasswordViolation.TOO_SHORT);
		assertThat(policy.check(EMAIL, "ключ-доступа")).isEmpty();
	}

	@Test
	void ac11RejectsPasswordsLongerThan128Characters() {
		assertThat(policy.check(EMAIL, "b".repeat(128))).isEmpty();
		assertThat(policy.check(EMAIL, "b".repeat(129))).contains(PasswordViolation.TOO_LONG);
	}

	@Test
	void ac11RejectsThePasswordEqualToTheEmailIgnoringCase() {
		assertThat(policy.check(EMAIL, "ada.lovelace@EXAMPLE.com")).contains(PasswordViolation.MATCHES_EMAIL);
	}

	@Test
	void ac11RejectsCommonPasswordsFromTheBundledListIgnoringCase() {
		assertThat(policy.check(EMAIL, "012345678910")).contains(PasswordViolation.TOO_COMMON);
		assertThat(policy.check(EMAIL, "01TeleMike01")).contains(PasswordViolation.TOO_COMMON);
	}

	@Test
	void ac11AcceptsALongPassphraseWithoutCharacterClassRules() {
		assertThat(policy.check(EMAIL, "correct horse battery staple")).isEmpty();
	}
}
