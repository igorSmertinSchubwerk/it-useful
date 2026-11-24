package com.ituseful.backend.mail;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

@Configuration(proxyBeanMethods = false)
@Profile("server")
@EnableConfigurationProperties(LinkMailProperties.class)
class MailConfiguration {

	private static final String TIMEOUT_MILLIS = "10000";

	@Bean
	LinkMailer linkMailer(LinkMailProperties properties) {
		if (!properties.isConfigured()) {
			return LinkMailer.disabled();
		}
		return new LinkMailer(sender(properties), properties.from());
	}

	/**
	 * The sender is not a bean, so an unreachable mail server never turns the
	 * application's health check red.
	 */
	private static JavaMailSenderImpl sender(LinkMailProperties properties) {
		JavaMailSenderImpl sender = new JavaMailSenderImpl();
		sender.setHost(properties.host());
		sender.setPort(properties.port() == null ? 25 : properties.port());
		boolean authenticated = properties.username() != null && !properties.username().isBlank();
		boolean starttls = properties.starttls() == null || properties.starttls();
		if (authenticated) {
			sender.setUsername(properties.username());
			sender.setPassword(properties.password());
		}
		Properties mail = sender.getJavaMailProperties();
		mail.put("mail.smtp.auth", String.valueOf(authenticated));
		mail.put("mail.smtp.starttls.enable", String.valueOf(starttls));
		mail.put("mail.smtp.starttls.required", String.valueOf(starttls));
		mail.put("mail.smtp.connectiontimeout", TIMEOUT_MILLIS);
		mail.put("mail.smtp.timeout", TIMEOUT_MILLIS);
		mail.put("mail.smtp.writetimeout", TIMEOUT_MILLIS);
		return sender;
	}
}
