package com.ituseful.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class ApiSecurityFilterTests {

	private final ApiSecurityFilter filter = new ApiSecurityFilter();

	@Test
	void addsBrowserSecurityHeaders() throws Exception {
		MockHttpServletResponse response = perform("GET", null, null);

		assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
		assertThat(response.getHeader("Content-Security-Policy"))
				.isEqualTo("default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
		assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY");
		assertThat(response.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
		assertThat(response.getHeader("Permissions-Policy")).contains("camera=()");
		assertThat(response.getHeader("X-XSS-Protection")).isEqualTo("0");
	}

	@Test
	void rejectsCrossSiteAndNonLoopbackBrowserWrites() throws Exception {
		MockHttpServletResponse crossSite = perform("POST", "http://127.0.0.1:5173", "cross-site");
		MockHttpServletResponse hostileOrigin = perform("DELETE", "https://example.test", null);

		for (MockHttpServletResponse response : new MockHttpServletResponse[] {crossSite, hostileOrigin}) {
			assertThat(response.getStatus()).isEqualTo(403);
			assertThat(response.getContentType()).isEqualTo("application/problem+json");
			assertThat(response.getContentAsString()).contains("cross_origin_forbidden");
			assertThat(response.getHeader("Access-Control-Allow-Origin")).isNull();
		}
	}

	@Test
	void permitsLoopbackBrowserWritesAndNonBrowserClients() throws Exception {
		assertThat(perform("PATCH", "http://localhost:5173", "same-site").getStatus()).isEqualTo(200);
		assertThat(perform("POST", "http://[::1]:4173", null).getStatus()).isEqualTo(200);
		assertThat(perform("PUT", null, null).getStatus()).isEqualTo(200);
	}

	@Test
	void rejectsMalformedAndCredentialedOrigins() throws Exception {
		assertThat(perform("POST", "null", null).getStatus()).isEqualTo(403);
		assertThat(perform("POST", "http://user@localhost:5173", null).getStatus()).isEqualTo(403);
		assertThat(perform("POST", "http://localhost:5173/path", null).getStatus()).isEqualTo(403);
	}

	private MockHttpServletResponse perform(String method, String origin, String fetchSite) throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest(method, "/api/elements");
		if (origin != null) request.addHeader("Origin", origin);
		if (fetchSite != null) request.addHeader("Sec-Fetch-Site", fetchSite);
		MockHttpServletResponse response = new MockHttpServletResponse();
		filter.doFilter(request, response, new MockFilterChain());
		return response;
	}
}
