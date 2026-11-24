package com.ituseful.backend.security;

import jakarta.servlet.http.HttpSession;

/**
 * Ties a browser session to the account's session version at sign-in. When the
 * account's version moves on, every session that recorded an older one ends.
 */
public final class SessionVersion {

	static final String ATTRIBUTE = "IT_USEFUL_SESSION_VERSION";

	private SessionVersion() {
	}

	public static void remember(HttpSession session, int version) {
		session.setAttribute(ATTRIBUTE, version);
	}

	public static boolean matches(HttpSession session, int version) {
		return session != null && Integer.valueOf(version).equals(session.getAttribute(ATTRIBUTE));
	}
}
