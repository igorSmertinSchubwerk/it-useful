package com.ituseful.backend.config;

import com.ituseful.backend.repository.ElementImageRepository;
import com.ituseful.backend.repository.ElementRepository;
import com.ituseful.backend.support.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static com.ituseful.backend.security.GitHubOwnerOAuth2UserService.OWNER_AUTHORITY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

	private static final byte[] PNG = {
			(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
	};

	private final MockMvc mockMvc;
	private final Environment environment;
	private final ElementRepository elementRepository;
	private final ElementImageRepository imageRepository;

	@Autowired
	ServerSecurityIntegrationTests(
			MockMvc mockMvc,
			Environment environment,
			ElementRepository elementRepository,
			ElementImageRepository imageRepository
	) {
		this.mockMvc = mockMvc;
		this.environment = environment;
		this.elementRepository = elementRepository;
		this.imageRepository = imageRepository;
	}

	@Test
	void trustsForwardingHeadersOnlyInTheExplicitServerProfile() {
		assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("native");
		assertThat(environment.getProperty("server.tomcat.remoteip.internal-proxies"))
				.contains("172\\.(1[6-9]|2\\d|3[0-1])");
		assertThat(environment.getProperty("server.servlet.session.cookie.name")).isEqualTo("IT_USEFUL_SESSION");
		assertThat(environment.getProperty("server.servlet.session.cookie.secure")).isEqualTo("true");
		assertThat(environment.getProperty("server.servlet.session.cookie.http-only")).isEqualTo("true");
		assertThat(environment.getProperty("server.servlet.session.cookie.same-site")).isEqualTo("lax");
		assertThat(environment.getProperty("springdoc.api-docs.enabled")).isEqualTo("false");
		assertThat(environment.getProperty("springdoc.swagger-ui.enabled")).isEqualTo("false");
	}

	@Test
	void rejectsAnonymousAccessToEveryPrivateRoute() throws Exception {
		for (AbstractMockHttpServletRequestBuilder<?> request : privateRouteRequests()) {
			mockMvc.perform(request)
					.andExpect(status().isUnauthorized())
					.andExpect(header().string("Content-Type", containsString("application/problem+json")))
					.andExpect(jsonPath("$.code").value("authentication_required"));
		}
	}

	@Test
	void rejectsEveryPrivateRouteForAnAuthenticatedNonOwner() throws Exception {
		for (AbstractMockHttpServletRequestBuilder<?> request : privateRouteRequests()) {
			mockMvc.perform(request.with(nonOwner()).with(csrf()))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("forbidden"));
		}
	}

	@Test
	void letsTheOwnerCompleteEveryPrivateApiWorkflow() throws Exception {
		mockMvc.perform(get("/api/session").with(owner()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.authenticated").value(true))
				.andExpect(jsonPath("$.role").value("OWNER"))
				.andExpect(jsonPath("$.login").value("owner"))
				.andExpect(jsonPath("$.csrf.headerName").value("X-CSRF-TOKEN"))
				.andExpect(jsonPath("$.csrf.token").isNotEmpty());

		mockMvc.perform(post("/api/elements")
					.with(owner()).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("security-matrix", "Initial")))
				.andExpect(status().isCreated());
		UUID elementId = elementRepository.findBySlugIgnoreCase("security-matrix").orElseThrow().getId();

		mockMvc.perform(get("/api/elements").with(owner())).andExpect(status().isOk());
		mockMvc.perform(get("/api/elements/{id}", elementId).with(owner())).andExpect(status().isOk());
		mockMvc.perform(put("/api/elements/{id}", elementId)
					.with(owner()).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("security-matrix-updated", "Updated")))
				.andExpect(status().isOk());

		mockMvc.perform(multipart("/api/elements/{id}/images", elementId)
					.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG))
					.with(owner()).with(csrf()))
				.andExpect(status().isCreated());
		UUID imageId = imageRepository.findAllByElementIdOrderByDisplayOrder(elementId).getFirst().getId();

		mockMvc.perform(get("/api/images/{id}", imageId).with(owner())).andExpect(status().isOk());
		mockMvc.perform(patch("/api/images/{id}", imageId)
					.with(owner()).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"altText\":\"Verified\",\"displayOrder\":1}"))
				.andExpect(status().isOk());
		mockMvc.perform(delete("/api/images/{id}", imageId).with(owner()).with(csrf()))
				.andExpect(status().isNoContent());
		mockMvc.perform(delete("/api/elements/{id}", elementId).with(owner()).with(csrf()))
				.andExpect(status().isNoContent());
	}

	@Test
	void rejectsMissingAndInvalidCsrfForEveryStateChangingRoute() throws Exception {
		for (AbstractMockHttpServletRequestBuilder<?> request : stateChangingRequests()) {
			mockMvc.perform(request.with(owner()))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("csrf_invalid"));
		}
		for (AbstractMockHttpServletRequestBuilder<?> request : stateChangingRequests()) {
			mockMvc.perform(request.with(owner()).with(csrf().useInvalidToken()))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("csrf_invalid"));
		}
	}

	@Test
	void enforcesTheConfiguredOriginForBrowserWrites() throws Exception {
		mockMvc.perform(post("/api/elements")
					.with(owner()).with(csrf())
					.header("Origin", "https://attacker.example")
					.header("Sec-Fetch-Site", "cross-site")
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("blocked", "Blocked")))
				.andExpect(status().isForbidden())
				.andExpect(header().doesNotExist("Access-Control-Allow-Origin"))
				.andExpect(jsonPath("$.code").value("cross_origin_forbidden"));
		assertThat(elementRepository.findBySlugIgnoreCase("blocked")).isEmpty();

		mockMvc.perform(post("/api/elements")
					.with(owner()).with(csrf())
					.header("Origin", "https://it-useful.example.ts.net")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation_failed"));
	}

	@Test
	void requiresCsrfForLogoutAndInvalidatesTheOwnerSession() throws Exception {
		mockMvc.perform(get("/logout").with(owner())).andExpect(status().isForbidden());

		MvcResult authenticated = mockMvc.perform(get("/api/session").with(owner()))
				.andExpect(status().isOk())
				.andReturn();
		MockHttpSession session = (MockHttpSession) authenticated.getRequest().getSession(false);

		mockMvc.perform(post("/logout").session(session).with(csrf()))
				.andExpect(status().isNoContent());
		assertThat(session.isInvalid()).isTrue();
	}

	@Test
	void treatsAnEmptyReplacementSessionAsExpired() throws Exception {
		mockMvc.perform(get("/api/session").session(new MockHttpSession()))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("authentication_required"));
	}

	@Test
	void keepsHealthInternalReadyAndOtherBackendRoutesDenied() throws Exception {
		mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mockMvc.perform(get("/v3/api-docs").with(owner())).andExpect(status().isForbidden());
		mockMvc.perform(get("/swagger-ui.html").with(owner())).andExpect(status().isForbidden());
		mockMvc.perform(get("/not-an-application-route").with(owner())).andExpect(status().isForbidden());
	}

	@Test
	void buildsTheGitHubAuthorizationRedirectFromTheConfiguredHttpsOrigin() throws Exception {
		mockMvc.perform(get("/oauth2/authorization/github")
					.header("Forwarded", "for=203.0.113.8;proto=http;host=attacker.example")
					.header("X-Forwarded-Proto", "http")
					.header("X-Forwarded-Host", "attacker.example"))
				.andExpect(status().is3xxRedirection())
				.andExpect(header().string("Location", startsWith("https://github.com/login/oauth/authorize?")))
				.andExpect(header().string("Location", containsString(
						"redirect_uri=https://it-useful.example.ts.net/login/oauth2/code/github")));
	}

	private static List<AbstractMockHttpServletRequestBuilder<?>> privateRouteRequests() {
		UUID elementId = UUID.fromString("00000000-0000-0000-0000-000000000017");
		UUID imageId = UUID.fromString("00000000-0000-0000-0000-000000000018");
		return List.of(
				get("/api/session"), get("/api/elements"), get("/api/elements/{id}", elementId),
				post("/api/elements").contentType(MediaType.APPLICATION_JSON).content("{}"),
				put("/api/elements/{id}", elementId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/elements/{id}", elementId),
				multipart("/api/elements/{id}/images", elementId)
						.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG)),
				get("/api/images/{id}", imageId),
				patch("/api/images/{id}", imageId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/images/{id}", imageId)
		);
	}

	private static List<AbstractMockHttpServletRequestBuilder<?>> stateChangingRequests() {
		UUID elementId = UUID.fromString("00000000-0000-0000-0000-000000000017");
		UUID imageId = UUID.fromString("00000000-0000-0000-0000-000000000018");
		return List.of(
				post("/api/elements").contentType(MediaType.APPLICATION_JSON).content("{}"),
				put("/api/elements/{id}", elementId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/elements/{id}", elementId),
				multipart("/api/elements/{id}/images", elementId)
						.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG)),
				patch("/api/images/{id}", imageId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/images/{id}", imageId), post("/logout")
		);
	}

	private static String validElementRequest(String slug, String titlePrefix) {
		return """
				{
				  "slug": "%s",
				  "translations": [
				    {"languageCode": "EN", "title": "%s EN", "content": "English content", "examples": "English example"},
				    {"languageCode": "DE", "title": "%s DE", "content": "German content", "examples": "German example"},
				    {"languageCode": "RU", "title": "%s RU", "content": "Russian content", "examples": "Russian example"}
				  ]
				}
				""".formatted(slug, titlePrefix, titlePrefix, titlePrefix);
	}

	private static RequestPostProcessor owner() {
		return oauth2Login()
				.attributes(attributes -> {
					attributes.put("id", 42);
					attributes.put("login", "owner");
				})
				.authorities(new SimpleGrantedAuthority(OWNER_AUTHORITY));
	}

	private static RequestPostProcessor nonOwner() {
		return oauth2Login().attributes(attributes -> {
			attributes.put("id", 43);
			attributes.put("login", "other");
		});
	}
}
