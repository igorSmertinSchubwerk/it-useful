package com.ituseful.backend.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Tries to email a link and reports whether it went out. The admin always gets
 * the link as well, so a failed send only produces a warning.
 */
@Component
@Profile("server")
public class LinkDelivery {

	private static final Logger log = LoggerFactory.getLogger(LinkDelivery.class);

	private final LinkMailer mailer;

	public LinkDelivery(LinkMailer mailer) {
		this.mailer = mailer;
	}

	/**
	 * Returns whether the email was handed to the mail server. The result is the
	 * point of the call, because the admin must learn whether to pass the link on.
	 */
	public boolean trySend(LinkEmail email, String purpose, UUID id) {
		if (!mailer.isEnabled()) {
			return false;
		}
		try {
			mailer.send(email);
			return true;
		} catch (MailException exception) {
			log.warn("Email for {} {} could not be sent ({})", purpose, id, exception.getClass().getSimpleName());
			return false;
		}
	}
}
