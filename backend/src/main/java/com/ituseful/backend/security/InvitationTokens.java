package com.ituseful.backend.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Creates single-use link tokens and the SHA-256 hash that is stored instead of
 * the token. The first-admin script computes the same hash with sha256sum.
 */
public final class InvitationTokens {

	private static final int TOKEN_BYTES = 32;

	private final SecureRandom random;

	public InvitationTokens(SecureRandom random) {
		this.random = random;
	}

	public String generate() {
		byte[] bytes = new byte[TOKEN_BYTES];
		random.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	public static String hash(String token) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is required by every Java runtime", exception);
		}
	}
}
