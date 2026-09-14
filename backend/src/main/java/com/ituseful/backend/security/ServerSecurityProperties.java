package com.ituseful.backend.security;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;

@ConfigurationProperties("app.security")
@Validated
public class ServerSecurityProperties {

	@NotNull
	private final URI publicBaseUrl;

	@NotNull
	@Positive
	private final Long ownerGithubId;

	@NotBlank
	private final String githubClientId;

	@NotBlank
	private final String githubClientSecret;

	public ServerSecurityProperties(
			URI publicBaseUrl,
			Long ownerGithubId,
			String githubClientId,
			String githubClientSecret
	) {
		this.publicBaseUrl = publicBaseUrl;
		this.ownerGithubId = ownerGithubId;
		this.githubClientId = githubClientId;
		this.githubClientSecret = githubClientSecret;
	}

	public URI getPublicBaseUrl() {
		return publicBaseUrl;
	}

	public Long getOwnerGithubId() {
		return ownerGithubId;
	}

	public String getGithubClientId() {
		return githubClientId;
	}

	public String getGithubClientSecret() {
		return githubClientSecret;
	}

	@AssertTrue(message = "must be an HTTPS origin without credentials, path, query, or fragment")
	public boolean isValidPublicBaseUrl() {
		if (publicBaseUrl == null) return true;
		String path = publicBaseUrl.getPath();
		return "https".equalsIgnoreCase(publicBaseUrl.getScheme())
				&& publicBaseUrl.getHost() != null
				&& !publicBaseUrl.getHost().isBlank()
				&& publicBaseUrl.getUserInfo() == null
				&& (path == null || path.isEmpty() || "/".equals(path))
				&& publicBaseUrl.getQuery() == null
				&& publicBaseUrl.getFragment() == null;
	}

	public String publicOrigin() {
		String value = publicBaseUrl.toString();
		return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
	}
}
