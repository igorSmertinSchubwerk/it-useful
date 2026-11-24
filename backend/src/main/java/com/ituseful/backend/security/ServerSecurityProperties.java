package com.ituseful.backend.security;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;

@ConfigurationProperties("app.security")
@Validated
public class ServerSecurityProperties {

	@NotNull
	private final URI publicBaseUrl;

	public ServerSecurityProperties(URI publicBaseUrl) {
		this.publicBaseUrl = publicBaseUrl;
	}

	public URI getPublicBaseUrl() {
		return publicBaseUrl;
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
