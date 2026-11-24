package com.ituseful.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ServerSecurityPropertiesTests {

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
			.withUserConfiguration(PropertiesConfiguration.class);

	@Test
	void acceptsAnHttpsOriginConfiguration() {
		contextRunner.withPropertyValues("app.security.public-base-url=https://it-useful.example.ts.net/")
				.run(context -> {
					assertThat(context).hasNotFailed();
					ServerSecurityProperties properties = context.getBean(ServerSecurityProperties.class);
					assertThat(properties.publicOrigin()).isEqualTo("https://it-useful.example.ts.net");
				});
	}

	@Test
	void rejectsAMissingPublicBaseUrl() {
		contextRunner.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void rejectsUnsafePublicBaseUrls() {
		for (String invalid : List.of(
				"http://it-useful.example.ts.net",
				"https://user@it-useful.example.ts.net",
				"https://it-useful.example.ts.net/path",
				"https://it-useful.example.ts.net?query=value"
		)) {
			contextRunner.withPropertyValues("app.security.public-base-url=" + invalid).run(context ->
					assertThat(context).as("invalid %s", invalid).hasFailed());
		}
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties(ServerSecurityProperties.class)
	static class PropertiesConfiguration {
	}
}
