package com.ituseful.backend.mail;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Sends link emails when SMTP is configured. A disabled mailer sends nothing.
 */
public final class LinkMailer {

	private final JavaMailSender sender;
	private final String from;

	LinkMailer(JavaMailSender sender, String from) {
		this.sender = sender;
		this.from = from;
	}

	static LinkMailer disabled() {
		return new LinkMailer(null, null);
	}

	public boolean isEnabled() {
		return sender != null;
	}

	public void send(LinkEmail email) {
		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom("IT Useful <" + from + ">");
		message.setTo(email.to());
		message.setSubject(email.subject());
		message.setText(email.text());
		sender.send(message);
	}
}
