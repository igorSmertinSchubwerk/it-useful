package com.ituseful.backend.mail;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Builds the bilingual plain-text emails that carry invitation and reset links.
 * The invitee's language is unknown, so every email has German first and English
 * second, like the legal pages.
 */
public final class LinkEmails {

	private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");
	private static final DateTimeFormatter GERMAN = DateTimeFormatter.ofPattern("dd.MM.yyyy, HH:mm 'Uhr'");
	private static final DateTimeFormatter ENGLISH = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm '(Berlin time)'");

	private LinkEmails() {
	}

	public static LinkEmail invitation(String to, String link, Instant expiresAt) {
		return new LinkEmail(to, "Einladung zu IT Useful / Invitation to IT Useful", """
				Hallo,

				Sie wurden zu IT Useful eingeladen. Öffnen Sie diesen Link, um Ihr Passwort festzulegen:
				%1$s

				Der Link gilt einmal bis %2$s. Danach bestätigt ein Admin Ihr Konto.
				Wenn Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.

				---

				Hello,

				You have been invited to IT Useful. Open this link to choose your password:
				%1$s

				The link works once until %3$s. An admin then confirms your account.
				If you did not expect this invitation, ignore this email.
				""".formatted(link, german(expiresAt), english(expiresAt)));
	}

	public static LinkEmail passwordReset(String to, String link, Instant expiresAt) {
		return new LinkEmail(to, "Neues Passwort für IT Useful / New password for IT Useful", """
				Hallo,

				ein Admin hat für Ihr Konto bei IT Useful einen Link zum Zurücksetzen des Passworts erstellt:
				%1$s

				Der Link gilt einmal bis %2$s. Danach werden alle Ihre Sitzungen abgemeldet.
				Wenn Sie kein neues Passwort brauchen, ignorieren Sie diese E-Mail.

				---

				Hello,

				An admin created a password reset link for your IT Useful account:
				%1$s

				The link works once until %3$s. Afterwards, all your sessions are signed out.
				If you do not need a new password, ignore this email.
				""".formatted(link, german(expiresAt), english(expiresAt)));
	}

	private static String german(Instant instant) {
		return GERMAN.format(instant.atZone(BERLIN));
	}

	private static String english(Instant instant) {
		return ENGLISH.format(instant.atZone(BERLIN));
	}
}
