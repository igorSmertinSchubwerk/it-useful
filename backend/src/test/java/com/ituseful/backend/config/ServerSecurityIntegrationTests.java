package com.ituseful.backend.config;

import com.ituseful.backend.support.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static com.ituseful.backend.security.GitHubOwnerOAuth2UserService.OWNER_AUTHORITY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
		"app.security.public-base-url=https://it-useful.example.ts.net",
		"app.security.owner-github-id=42",
		"app.security.github-client-id=test-client-id",
		"app.security.github-client-secret=test-client-secret"
})
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
class ServerSecurityIntegrationTests {

	private final MockMvc mockMvc;
	private final Environment environment;

	@Autowired
	ServerSecurityIntegrationTests(MockMvc mockMvc, Environment environment) {
		this.mockMvc = mockMvc;
		this.environment = environment;
	}

	@Test
	void trustsForwardingHeadersOnlyInTheExplicitServerProfile() {
		assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("native");
		assertThat(environment.getProperty("server.tomcat.remoteip.internal-proxies"))
				.contains("172\\.(1[6-9]|2\\d|3[0-1])");
	}

	@Test
	void requiresAuthenticationForPrivateApiData() throws Exception {
		mockMvc.perform(get("/api/elements"))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string("Content-Type", containsString("application/problem+json")))
				.andExpect(jsonPath("$.code").value("authentication_required"));
	}

	@Test
	void deniesAuthenticatedUsersWithoutOwnerAuthority() throws Exception {
		mockMvc.perform(get("/api/elements")
					.with(oauth2Login().attributes(attributes -> {
						attributes.put("id", 43);
						attributes.put("login", "other");
					})))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("forbidden"));
	}

	@Test
	void allowsTheOwnerToReadDataAndSessionCsrfContract() throws Exception {
		mockMvc.perform(get("/api/elements").with(owner()))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/session").with(owner()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.authenticated").value(true))
				.andExpect(jsonPath("$.role").value("OWNER"))
				.andExpect(jsonPath("$.login").value("owner"))
				.andExpect(jsonPath("$.csrf.headerName").value("X-CSRF-TOKEN"))
				.andExpect(jsonPath("$.csrf.token").isNotEmpty());
	}

	@Test
	void rejectsOwnerWritesWithoutCsrfAndAcceptsAValidToken() throws Exception {
		mockMvc.perform(post("/api/elements")
					.with(owner())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("csrf_invalid"));

		mockMvc.perform(post("/api/elements")
					.with(owner())
					.with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation_failed"));
	}

	@Test
	void requiresCsrfForLogoutAndInvalidatesTheOwnerSession() throws Exception {
		mockMvc.perform(get("/logout").with(owner()))
				.andExpect(status().isForbidden());

		mockMvc.perform(post("/logout").with(owner()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("csrf_invalid"));

		MvcResult authenticated = mockMvc.perform(get("/api/session").with(owner()))
				.andExpect(status().isOk())
				.andReturn();
		MockHttpSession session = (MockHttpSession) authenticated.getRequest().getSession(false);

		mockMvc.perform(post("/logout").session(session).with(csrf()))
				.andExpect(status().isNoContent());
		assertThat(session.isInvalid()).isTrue();
	}

	@Test
	void keepsHealthInternalReadyAndOtherBackendRoutesDenied() throws Exception {
		mockMvc.perform(get("/actuator/health"))
				.andExpect(status().isOk());
		mockMvc.perform(get("/v3/api-docs").with(owner()))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/not-an-application-route").with(owner()))
				.andExpect(status().isForbidden());
	}

	@Test
	void buildsTheGitHubAuthorizationRedirectFromTheConfiguredHttpsOrigin() throws Exception {
		mockMvc.perform(get("/oauth2/authorization/github"))
				.andExpect(status().is3xxRedirection())
				.andExpect(header().string("Location", startsWith("https://github.com/login/oauth/authorize?")))
				.andExpect(header().string("Location", containsString(
						"redirect_uri=https://it-useful.example.ts.net/login/oauth2/code/github")));
	}

	private static org.springframework.test.web.servlet.request.RequestPostProcessor owner() {
		return oauth2Login()
				.attributes(attributes -> {
					attributes.put("id", 42);
					attributes.put("login", "owner");
				})
				.authorities(new SimpleGrantedAuthority(OWNER_AUTHORITY));
	}
}
