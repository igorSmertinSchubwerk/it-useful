package com.ituseful.backend.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Optional SMTP settings. Without a host, no email is sent and admins copy
 * every link by hand.
 */
@ConfigurationProperties("app.mail")
public record LinkMailProperties(
		String host,
		Integer port,
		String from,
		String username,
		String password,
		Boolean starttls
) {

	public boolean isConfigured() {
		return host != null && !host.isBlank();
	}
}
