package com.ituseful.backend.controller;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.support.PostgresTestConfiguration;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.security.public-base-url=https://it-useful.example.ts.net")
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class AccountAdministrationIntegrationTests {

	private static final String PASSWORD = "correct horse battery staple";
	private static final String NEW_PASSWORD = "a different horse battery staple";
	private static final String ADMIN = "admin@example.com";
	private static final String USER = "reader@example.com";
	private static final String RESET_PREFIX = "https://it-useful.example.ts.net/reset-password#";
	private static final String INVALID_RESET = "This password reset link is invalid or has expired";

	private final MockMvc mockMvc;
	private final AccountRepository accountRepository;
	private final PasswordEncoder passwordEncoder;
	private final JdbcTemplate jdbcTemplate;
	private final EntityManager entityManager;

	@Autowired
	AccountAdministrationIntegrationTests(
			MockMvc mockMvc,
			AccountRepository accountRepository,
			PasswordEncoder passwordEncoder,
			JdbcTemplate jdbcTemplate,
			EntityManager entityManager
	) {
		this.mockMvc = mockMvc;
		this.accountRepository = accountRepository;
		this.passwordEncoder = passwordEncoder;
		this.jdbcTemplate = jdbcTemplate;
		this.entityManager = entityManager;
	}

	@BeforeEach
	void createAccounts() {
		String hash = passwordEncoder.encode(PASSWORD);
		accountRepository.saveAll(List.of(
				new Account(ADMIN, hash, AccountRole.ADMIN, AccountStatus.CONFIRMED),
				new Account(USER, hash, AccountRole.USER, AccountStatus.CONFIRMED)
		));
		accountRepository.flush();
	}

	@Test
	void ac15PasswordChangeNeedsTheCurrentPasswordAndEndsOtherSessions() throws Exception {
		MockHttpSession current = signIn(USER, PASSWORD);
		MockHttpSession other = signIn(USER, PASSWORD);

		changePassword(current, "wrong current password", NEW_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("current_password_incorrect"));
		changePassword(current, PASSWORD, "too short")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.violation").value("TOO_SHORT"));
		changePassword(current, PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

		mockMvc.perform(get("/api/elements").session(current)).andExpect(status().isOk());
		mockMvc.perform(get("/api/elements").session(other)).andExpect(status().isUnauthorized());
		attemptSignIn(USER, PASSWORD).andExpect(status().isUnauthorized());
		signIn(USER, NEW_PASSWORD);
	}

	@Test
	void ac16ResetLinkIsSingleUseHashedAndEndsEverySession() throws Exception {
		MockHttpSession userSession = signIn(USER, PASSWORD);
		MvcResult reset = createReset(signIn(ADMIN, PASSWORD), USER)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.link", startsWith(RESET_PREFIX)))
				.andReturn();
		String token = tokenFrom(reset);
		String storedHash = jdbcTemplate.queryForObject(
				"SELECT token_hash FROM password_reset WHERE id = ?::uuid", String.class, idFrom(reset));
		Instant expiresAt = jdbcTemplate.queryForObject(
				"SELECT expires_at FROM password_reset WHERE id = ?::uuid", Instant.class, idFrom(reset));
		assertThat(storedHash).isEqualTo(sha256Hex(token));
		assertThat(expiresAt).isBetween(
				Instant.now().plus(Duration.ofHours(24)).minusSeconds(60),
				Instant.now().plus(Duration.ofHours(24)).plusSeconds(60));

		completeReset(token, "too short").andExpect(jsonPath("$.code").value("password_rejected"));
		completeReset(token, NEW_PASSWORD).andExpect(status().isNoContent());

		mockMvc.perform(get("/api/elements").session(userSession)).andExpect(status().isUnauthorized());
		signIn(USER, NEW_PASSWORD);
		completeReset(token, NEW_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("reset_invalid"));
	}

	@Test
	void ac16NewerResetReplacesOlderAndExpiredOrUnknownLinksFailAlike() throws Exception {
		MockHttpSession admin = signIn(ADMIN, PASSWORD);
		String older = tokenFrom(createReset(admin, USER).andReturn());
		MvcResult newer = createReset(admin, USER).andReturn();
		jdbcTemplate.update("""
				UPDATE password_reset
				SET created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
				WHERE id = ?::uuid
				""", idFrom(newer));
		entityManager.clear();

		for (String token : List.of(older, tokenFrom(newer), "B".repeat(43))) {
			completeReset(token, NEW_PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("reset_invalid"))
					.andExpect(jsonPath("$.detail").value(INVALID_RESET));
		}
	}

	@Test
	void ac17RoleChangeAppliesToTheOpenSession() throws Exception {
		MockHttpSession userSession = signIn(USER, PASSWORD);
		mockMvc.perform(get("/api/admin/accounts").session(userSession)).andExpect(status().isForbidden());

		changeRole(signIn(ADMIN, PASSWORD), USER, "ADMIN").andExpect(status().isNoContent());

		mockMvc.perform(get("/api/admin/accounts").session(userSession)).andExpect(status().isOk());
	}

	@Test
	void ac17DisablingEndsTheSessionAndBlocksSignIn() throws Exception {
		MockHttpSession userSession = signIn(USER, PASSWORD);

		adminAction(signIn(ADMIN, PASSWORD), USER, "disable").andExpect(status().isNoContent());

		mockMvc.perform(get("/api/elements").session(userSession)).andExpect(status().isUnauthorized());
		attemptSignIn(USER, PASSWORD).andExpect(status().isUnauthorized());
	}

	@Test
	void ac18KeepsTheLastConfirmedAdmin() throws Exception {
		MockHttpSession admin = signIn(ADMIN, PASSWORD);

		adminAction(admin, ADMIN, "disable")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("last_admin"));
		changeRole(admin, ADMIN, "USER")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("last_admin"));

		changeRole(admin, USER, "ADMIN").andExpect(status().isNoContent());
		changeRole(admin, ADMIN, "USER").andExpect(status().isNoContent());
	}

	@Test
	void ac28EnablingRestoresADisabledAccountWithItsRole() throws Exception {
		MockHttpSession admin = signIn(ADMIN, PASSWORD);
		adminAction(admin, USER, "enable")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("account_not_disabled"));

		adminAction(admin, USER, "disable").andExpect(status().isNoContent());
		adminAction(admin, USER, "enable").andExpect(status().isNoContent());

		MockHttpSession userSession = signIn(USER, PASSWORD);
		mockMvc.perform(get("/api/session").session(userSession))
				.andExpect(jsonPath("$.status").value("CONFIRMED"))
				.andExpect(jsonPath("$.role").value("USER"));
	}

	@Test
	void listsOnlyOpenInvitations() throws Exception {
		MockHttpSession admin = signIn(ADMIN, PASSWORD);
		invite(admin, "open@example.com");
		String revoked = idFrom(invite(admin, "revoked@example.com").andReturn());
		mockMvc.perform(delete("/api/admin/invitations/{id}", revoked).session(admin).with(csrf()));

		mockMvc.perform(get("/api/admin/invitations").session(admin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].email").value("open@example.com"))
				.andExpect(jsonPath("$[0].link").doesNotExist());
	}

	@Test
	void ac20LogsAdministrationWithIdsOnly(CapturedOutput output) throws Exception {
		MockHttpSession admin = signIn(ADMIN, PASSWORD);
		UUID adminId = idOf(ADMIN);
		UUID userId = idOf(USER);

		changeRole(admin, USER, "ADMIN");
		changeRole(admin, USER, "USER");
		adminAction(admin, USER, "disable");
		adminAction(admin, USER, "enable");
		MvcResult reset = createReset(admin, USER).andReturn();
		completeReset(tokenFrom(reset), NEW_PASSWORD);
		changePassword(signIn(USER, NEW_PASSWORD), NEW_PASSWORD, PASSWORD);

		assertThat(output)
				.contains("Admin " + adminId + " changed the role of account " + userId + " to ADMIN")
				.contains("Admin " + adminId + " disabled account " + userId)
				.contains("Admin " + adminId + " enabled account " + userId)
				.contains("Admin " + adminId + " created password reset " + idFrom(reset) + " for account " + userId)
				.contains("Password reset " + idFrom(reset) + " used by account " + userId)
				.contains("Account " + userId + " changed its password")
				.doesNotContain(tokenFrom(reset))
				.doesNotContain(USER)
				.doesNotContain(NEW_PASSWORD);
	}

	private MockHttpSession signIn(String email, String password) throws Exception {
		MvcResult result = attemptSignIn(email, password).andExpect(status().isNoContent()).andReturn();
		return (MockHttpSession) result.getRequest().getSession(false);
	}

	private ResultActions attemptSignIn(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/session/login")
				.param("email", email).param("password", password).with(csrf()));
	}

	private ResultActions changePassword(MockHttpSession session, String current, String next) throws Exception {
		return mockMvc.perform(post("/api/session/password").session(session).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"currentPassword\":\"%s\",\"newPassword\":\"%s\"}".formatted(current, next)));
	}

	private ResultActions createReset(MockHttpSession admin, String email) throws Exception {
		return mockMvc.perform(post("/api/admin/accounts/{id}/password-resets", idOf(email))
				.session(admin).with(csrf()));
	}

	private ResultActions completeReset(String token, String password) throws Exception {
		return mockMvc.perform(post("/api/password-resets/complete").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"%s\",\"password\":\"%s\"}".formatted(token, password)));
	}

	private ResultActions changeRole(MockHttpSession admin, String email, String role) throws Exception {
		return mockMvc.perform(put("/api/admin/accounts/{id}/role", idOf(email)).session(admin).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"role\":\"%s\"}".formatted(role)));
	}

	private ResultActions adminAction(MockHttpSession admin, String email, String action) throws Exception {
		return mockMvc.perform(post("/api/admin/accounts/{id}/" + action, idOf(email)).session(admin).with(csrf()));
	}

	private ResultActions invite(MockHttpSession admin, String email) throws Exception {
		return mockMvc.perform(post("/api/admin/invitations").session(admin).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"role\":\"USER\"}".formatted(email)));
	}

	private UUID idOf(String email) {
		return accountRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
	}

	private static String tokenFrom(MvcResult result) throws Exception {
		String link = JsonPath.read(result.getResponse().getContentAsString(), "$.link");
		return link.substring(link.indexOf('#') + 1);
	}

	private static String idFrom(MvcResult result) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
	}

	private static String sha256Hex(String value) throws Exception {
		return HexFormat.of().formatHex(
				MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
	}
}
