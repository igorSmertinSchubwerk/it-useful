package com.ituseful.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ServerSecurityPropertiesTests {

	private static final List<String> VALID_PROPERTIES = List.of(
			"app.security.public-base-url=https://it-useful.example.ts.net",
			"app.security.owner-github-id=42",
			"app.security.github-client-id=test-client-id",
			"app.security.github-client-secret=test-client-secret"
	);

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
			.withUserConfiguration(PropertiesConfiguration.class);

	@Test
	void acceptsACompleteHttpsOriginConfiguration() {
		contextRunner.withPropertyValues(VALID_PROPERTIES.toArray(String[]::new)).run(context -> {
			assertThat(context).hasNotFailed();
			ServerSecurityProperties properties = context.getBean(ServerSecurityProperties.class);
			assertThat(properties.publicOrigin()).isEqualTo("https://it-useful.example.ts.net");
			assertThat(properties.getOwnerGithubId()).isEqualTo(42L);
		});
	}

	@Test
	void rejectsEachMissingRequiredSetting() {
		for (String missingName : List.of(
				"app.security.public-base-url",
				"app.security.owner-github-id",
				"app.security.github-client-id",
				"app.security.github-client-secret"
		)) {
			List<String> remaining = new ArrayList<>(VALID_PROPERTIES);
			remaining.removeIf(property -> property.startsWith(missingName + "="));
			contextRunner.withPropertyValues(remaining.toArray(String[]::new)).run(context ->
					assertThat(context).as("missing %s", missingName).hasFailed());
		}
	}

	@Test
	void rejectsUnsafePublicBaseUrlsAndInvalidOwnerIds() {
		for (String invalid : List.of(
				"app.security.public-base-url=http://it-useful.example.ts.net",
				"app.security.public-base-url=https://user@it-useful.example.ts.net",
				"app.security.public-base-url=https://it-useful.example.ts.net/path",
				"app.security.public-base-url=https://it-useful.example.ts.net?query=value",
				"app.security.owner-github-id=0"
		)) {
			String name = invalid.substring(0, invalid.indexOf('='));
			List<String> properties = new ArrayList<>(VALID_PROPERTIES);
			properties.removeIf(property -> property.startsWith(name + "="));
			properties.add(invalid);
			contextRunner.withPropertyValues(properties.toArray(String[]::new)).run(context ->
					assertThat(context).as("invalid %s", invalid).hasFailed());
		}
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties(ServerSecurityProperties.class)
	static class PropertiesConfiguration {
	}
}
