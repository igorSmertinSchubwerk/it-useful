package com.ituseful.backend.config;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.repository.ElementImageRepository;
import com.ituseful.backend.repository.ElementRepository;
import com.ituseful.backend.support.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.security.public-base-url=https://it-useful.example.ts.net")
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class ServerSecurityIntegrationTests {

	private static final byte[] PNG = {
			(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
	};
	private static final String PASSWORD = "correct horse battery staple";
	private static final String WRONG_PASSWORD = "incorrect horse battery staple";
	private static final String ADMIN = "admin@example.com";
	private static final String USER = "reader@example.com";
	private static final String ACCEPTED = "pending@example.com";
	private static final String DISABLED = "disabled@example.com";
	private static final String SIGN_IN_FAILED = "The email address or password is incorrect";

	private final MockMvc mockMvc;
	private final Environment environment;
	private final ElementRepository elementRepository;
	private final ElementImageRepository imageRepository;
	private final AccountRepository accountRepository;
	private final PasswordEncoder passwordEncoder;

	@Autowired
	ServerSecurityIntegrationTests(
			MockMvc mockMvc,
			Environment environment,
			ElementRepository elementRepository,
			ElementImageRepository imageRepository,
			AccountRepository accountRepository,
			PasswordEncoder passwordEncoder
	) {
		this.mockMvc = mockMvc;
		this.environment = environment;
		this.elementRepository = elementRepository;
		this.imageRepository = imageRepository;
		this.accountRepository = accountRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@BeforeEach
	void createAccounts() {
		String hash = passwordEncoder.encode(PASSWORD);
		accountRepository.saveAll(List.of(
				new Account(ADMIN, hash, AccountRole.ADMIN, AccountStatus.CONFIRMED),
				new Account(USER, hash, AccountRole.USER, AccountStatus.CONFIRMED),
				new Account(ACCEPTED, hash, AccountRole.USER, AccountStatus.ACCEPTED),
				new Account(DISABLED, hash, AccountRole.ADMIN, AccountStatus.DISABLED)
		));
		accountRepository.flush();
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
	void ac1RejectsAnonymousAccessToEveryPrivateRoute() throws Exception {
		for (AbstractMockHttpServletRequestBuilder<?> request : privateRouteRequests()) {
			mockMvc.perform(request)
					.andExpect(status().isUnauthorized())
					.andExpect(header().string("Content-Type", containsString("application/problem+json")))
					.andExpect(jsonPath("$.code").value("authentication_required"));
		}
	}

	@Test
	void ac1GivesAnonymousVisitorsACsrfTokenAndRotatesTheSessionOnSignIn() throws Exception {
		MvcResult csrfResult = mockMvc.perform(get("/api/session/csrf"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
				.andExpect(jsonPath("$.token").isNotEmpty())
				.andReturn();
		MockHttpSession anonymous = (MockHttpSession) csrfResult.getRequest().getSession(false);
		String anonymousId = anonymous.getId();

		MvcResult signedIn = mockMvc.perform(post("/api/session/login").session(anonymous)
						.with(presentedSessionCookie(anonymousId))
						.param("email", ADMIN).param("password", PASSWORD).with(csrf()))
				.andExpect(status().isNoContent())
				.andReturn();

		assertThat(signedIn.getRequest().getSession(false).getId()).isNotEqualTo(anonymousId);
	}

	@Test
	void ac2LetsAConfirmedUserReadButRejectsEveryContentWrite() throws Exception {
		MockHttpSession session = signIn(USER);

		mockMvc.perform(get("/api/session").session(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(USER))
				.andExpect(jsonPath("$.role").value("USER"))
				.andExpect(jsonPath("$.status").value("CONFIRMED"));
		mockMvc.perform(get("/api/elements").session(session)).andExpect(status().isOk());

		for (AbstractMockHttpServletRequestBuilder<?> request : contentWriteRequests()) {
			mockMvc.perform(request.session(session).with(csrf()))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("forbidden"));
		}
		mockMvc.perform(post("/api/elements").session(session).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("user-write", "Blocked")))
				.andExpect(status().isForbidden());
		assertThat(elementRepository.findBySlugIgnoreCase("user-write")).isEmpty();
	}

	@Test
	void ac3LetsAnAdminCompleteEveryContentWorkflow() throws Exception {
		MockHttpSession session = signIn(ADMIN);

		mockMvc.perform(get("/api/session").session(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(ADMIN))
				.andExpect(jsonPath("$.role").value("ADMIN"))
				.andExpect(jsonPath("$.status").value("CONFIRMED"))
				.andExpect(jsonPath("$.csrf.headerName").value("X-CSRF-TOKEN"))
				.andExpect(jsonPath("$.csrf.token").isNotEmpty());

		mockMvc.perform(post("/api/elements")
					.session(session).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("security-matrix", "Initial")))
				.andExpect(status().isCreated());
		UUID elementId = elementRepository.findBySlugIgnoreCase("security-matrix").orElseThrow().getId();

		mockMvc.perform(get("/api/elements").session(session)).andExpect(status().isOk());
		mockMvc.perform(get("/api/elements/{id}", elementId).session(session)).andExpect(status().isOk());
		mockMvc.perform(put("/api/elements/{id}", elementId)
					.session(session).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("security-matrix-updated", "Updated")))
				.andExpect(status().isOk());

		mockMvc.perform(multipart("/api/elements/{id}/images", elementId)
					.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG))
					.session(session).with(csrf()))
				.andExpect(status().isCreated());
		UUID imageId = imageRepository.findAllByElementIdOrderByDisplayOrder(elementId).getFirst().getId();

		mockMvc.perform(get("/api/images/{id}", imageId).session(session)).andExpect(status().isOk());
		mockMvc.perform(patch("/api/images/{id}", imageId)
					.session(session).with(csrf())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"altText\":\"Verified\",\"displayOrder\":1}"))
				.andExpect(status().isOk());
		mockMvc.perform(delete("/api/images/{id}", imageId).session(session).with(csrf()))
				.andExpect(status().isNoContent());
		mockMvc.perform(delete("/api/elements/{id}", elementId).session(session).with(csrf()))
				.andExpect(status().isNoContent());
	}

	@Test
	void ac4ReservesAccountManagementForAdmins() throws Exception {
		mockMvc.perform(get("/api/admin/accounts").session(signIn(USER)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("forbidden"));
		mockMvc.perform(get("/api/admin/accounts").session(signIn(ADMIN)))
				.andExpect(status().isNotFound());
	}

	@Test
	void acceptedAccountsSignInButCannotReadBeforeConfirmation() throws Exception {
		MockHttpSession session = signIn(ACCEPTED);

		mockMvc.perform(get("/api/session").session(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ACCEPTED"));
		mockMvc.perform(get("/api/elements").session(session))
				.andExpect(status().isForbidden());
	}

	@Test
	void ac13AnswersWrongPasswordsUnknownEmailsAndDisabledAccountsIdentically() throws Exception {
		for (String[] credentials : List.of(
				new String[] {ADMIN, WRONG_PASSWORD},
				new String[] {"nobody@example.com", PASSWORD},
				new String[] {DISABLED, PASSWORD}
		)) {
			attemptSignIn(credentials[0], credentials[1])
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.code").value("sign_in_failed"))
					.andExpect(jsonPath("$.detail").value(SIGN_IN_FAILED));
		}
	}

	@Test
	void ac14LocksOnlyTheAffectedAccountAfterFiveFailedSignIns() throws Exception {
		for (int attempt = 0; attempt < 5; attempt++) {
			attemptSignIn(USER, WRONG_PASSWORD).andExpect(status().isUnauthorized());
		}

		attemptSignIn(USER, PASSWORD)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.detail").value(SIGN_IN_FAILED));
		signIn(ADMIN);
	}

	@Test
	void ac20LogsFailedSignInsAndLockoutsWithoutSecrets(CapturedOutput output) throws Exception {
		UUID userId = accountRepository.findByEmailIgnoreCase(USER).orElseThrow().getId();

		attemptSignIn("nobody@example.com", WRONG_PASSWORD);
		for (int attempt = 0; attempt < 5; attempt++) {
			attemptSignIn(USER, WRONG_PASSWORD);
		}

		assertThat(output)
				.contains("Sign-in failed for account " + userId)
				.contains("Account " + userId + " locked for 15 minutes after 5 failed sign-ins")
				.contains("Sign-in failed for an unknown account")
				.doesNotContain(WRONG_PASSWORD)
				.doesNotContain("nobody@example.com")
				.doesNotContain(USER);
	}

	@Test
	void rejectsMissingAndInvalidCsrfForEveryStateChangingRoute() throws Exception {
		MockHttpSession session = signIn(ADMIN);
		for (AbstractMockHttpServletRequestBuilder<?> request : stateChangingRequests()) {
			mockMvc.perform(request.session(session))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("csrf_invalid"));
		}
		for (AbstractMockHttpServletRequestBuilder<?> request : stateChangingRequests()) {
			mockMvc.perform(request.session(session).with(csrf().useInvalidToken()))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("csrf_invalid"));
		}
	}

	@Test
	void enforcesTheConfiguredOriginForBrowserWrites() throws Exception {
		MockHttpSession session = signIn(ADMIN);
		mockMvc.perform(post("/api/elements")
					.session(session).with(csrf())
					.header("Origin", "https://attacker.example")
					.header("Sec-Fetch-Site", "cross-site")
					.contentType(MediaType.APPLICATION_JSON)
					.content(validElementRequest("blocked", "Blocked")))
				.andExpect(status().isForbidden())
				.andExpect(header().doesNotExist("Access-Control-Allow-Origin"))
				.andExpect(jsonPath("$.code").value("cross_origin_forbidden"));
		assertThat(elementRepository.findBySlugIgnoreCase("blocked")).isEmpty();

		mockMvc.perform(post("/api/elements")
					.session(session).with(csrf())
					.header("Origin", "https://it-useful.example.ts.net")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation_failed"));
	}

	@Test
	void requiresCsrfForLogoutAndInvalidatesTheSession() throws Exception {
		MockHttpSession session = signIn(ADMIN);
		mockMvc.perform(get("/logout").session(session)).andExpect(status().isForbidden());

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
		MockHttpSession session = signIn(ADMIN);
		mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mockMvc.perform(get("/v3/api-docs").session(session)).andExpect(status().isForbidden());
		mockMvc.perform(get("/swagger-ui.html").session(session)).andExpect(status().isForbidden());
		mockMvc.perform(get("/not-an-application-route").session(session)).andExpect(status().isForbidden());
	}

	private MockHttpSession signIn(String email) throws Exception {
		MvcResult result = attemptSignIn(email, PASSWORD).andExpect(status().isNoContent()).andReturn();
		return (MockHttpSession) result.getRequest().getSession(false);
	}

	/**
	 * A browser names its session in the cookie. Without that id the servlet API
	 * reports no valid requested session, and session fixation protection skips it.
	 */
	private static RequestPostProcessor presentedSessionCookie(String sessionId) {
		return request -> {
			request.setRequestedSessionId(sessionId);
			return request;
		};
	}

	private ResultActions attemptSignIn(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/session/login")
				.param("email", email)
				.param("password", password)
				.with(csrf()));
	}

	private static List<AbstractMockHttpServletRequestBuilder<?>> privateRouteRequests() {
		UUID elementId = UUID.fromString("00000000-0000-0000-0000-000000000017");
		UUID imageId = UUID.fromString("00000000-0000-0000-0000-000000000018");
		return List.of(
				get("/api/session"), get("/api/elements"), get("/api/elements/{id}", elementId),
				get("/api/images/{id}", imageId), get("/api/admin/accounts"),
				post("/api/elements").contentType(MediaType.APPLICATION_JSON).content("{}"),
				put("/api/elements/{id}", elementId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/elements/{id}", elementId),
				multipart("/api/elements/{id}/images", elementId)
						.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG)),
				patch("/api/images/{id}", imageId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/images/{id}", imageId)
		);
	}

	private static List<AbstractMockHttpServletRequestBuilder<?>> contentWriteRequests() {
		UUID elementId = UUID.fromString("00000000-0000-0000-0000-000000000017");
		UUID imageId = UUID.fromString("00000000-0000-0000-0000-000000000018");
		return List.of(
				post("/api/elements").contentType(MediaType.APPLICATION_JSON).content("{}"),
				put("/api/elements/{id}", elementId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/elements/{id}", elementId),
				multipart("/api/elements/{id}/images", elementId)
						.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG)),
				patch("/api/images/{id}", imageId).contentType(MediaType.APPLICATION_JSON).content("{}"),
				delete("/api/images/{id}", imageId)
		);
	}

	private static List<AbstractMockHttpServletRequestBuilder<?>> stateChangingRequests() {
		return Stream.concat(
				contentWriteRequests().stream(),
				Stream.of(post("/logout"))
		).toList();
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
}
