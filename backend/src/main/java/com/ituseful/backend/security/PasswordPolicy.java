package com.ituseful.backend.security;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Account password rules: 12 to 128 characters, not the account's email address,
 * and not a known common password. There are no character-class rules, because
 * they push people toward predictable patterns instead of longer passwords.
 */
public final class PasswordPolicy {

	private static final int MINIMUM_LENGTH = 12;
	private static final int MAXIMUM_LENGTH = 128;
	private static final String COMMON_PASSWORDS = "/security/common-passwords.txt";

	private final Set<String> commonPasswords;

	private PasswordPolicy(Set<String> commonPasswords) {
		this.commonPasswords = commonPasswords;
	}

	public static PasswordPolicy withBundledCommonPasswords() {
		InputStream stream = PasswordPolicy.class.getResourceAsStream(COMMON_PASSWORDS);
		if (stream == null) {
			throw new IllegalStateException("Missing classpath resource " + COMMON_PASSWORDS);
		}
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
			return new PasswordPolicy(reader.lines()
					.filter(line -> !line.isBlank() && !line.startsWith("#"))
					.collect(Collectors.toUnmodifiableSet()));
		} catch (IOException exception) {
			throw new UncheckedIOException(exception);
		}
	}

	public Optional<PasswordViolation> check(String email, String password) {
		int length = password.codePointCount(0, password.length());
		if (length < MINIMUM_LENGTH) {
			return Optional.of(PasswordViolation.TOO_SHORT);
		}
		if (length > MAXIMUM_LENGTH) {
			return Optional.of(PasswordViolation.TOO_LONG);
		}
		if (password.equalsIgnoreCase(email)) {
			return Optional.of(PasswordViolation.MATCHES_EMAIL);
		}
		if (commonPasswords.contains(password.toLowerCase(Locale.ROOT))) {
			return Optional.of(PasswordViolation.TOO_COMMON);
		}
		return Optional.empty();
	}
}
