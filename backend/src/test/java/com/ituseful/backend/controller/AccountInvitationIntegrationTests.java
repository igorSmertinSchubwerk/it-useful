package com.ituseful.backend.controller;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.domain.Invitation;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.repository.InvitationRepository;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.security.public-base-url=https://it-useful.example.ts.net")
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class AccountInvitationIntegrationTests {

	private static final String PASSWORD = "correct horse battery staple";
	private static final String ADMIN = "admin@example.com";
	private static final String SECOND_ADMIN = "second.admin@example.com";
	private static final String INVITEE = "new.person@example.com";
	private static final String LINK_PREFIX = "https://it-useful.example.ts.net/accept-invitation#";
	private static final String INVALID_LINK = "This invitation link is invalid or has expired";

	private final MockMvc mockMvc;
	private final AccountRepository accountRepository;
	private final InvitationRepository invitationRepository;
	private final PasswordEncoder passwordEncoder;
	private final JdbcTemplate jdbcTemplate;
	private final EntityManager entityManager;

	@Autowired
	AccountInvitationIntegrationTests(
			MockMvc mockMvc,
			AccountRepository accountRepository,
			InvitationRepository invitationRepository,
			PasswordEncoder passwordEncoder,
			JdbcTemplate jdbcTemplate,
			EntityManager entityManager
	) {
		this.mockMvc = mockMvc;
		this.accountRepository = accountRepository;
		this.invitationRepository = invitationRepository;
		this.passwordEncoder = passwordEncoder;
		this.jdbcTemplate = jdbcTemplate;
		this.entityManager = entityManager;
	}

	@BeforeEach
	void createAdmins() {
		String hash = passwordEncoder.encode(PASSWORD);
		accountRepository.saveAll(List.of(
				new Account(ADMIN, hash, AccountRole.ADMIN, AccountStatus.CONFIRMED),
				new Account(SECOND_ADMIN, hash, AccountRole.ADMIN, AccountStatus.CONFIRMED)
		));
		accountRepository.flush();
	}

	@Test
	void ac5InvitesWithASingleUseSevenDayLinkAndStoresOnlyTheTokenHash() throws Exception {
		MvcResult result = invite(signIn(ADMIN), "New.Person@Example.com", "USER")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.email").value(INVITEE))
				.andExpect(jsonPath("$.role").value("USER"))
				.andExpect(jsonPath("$.link", startsWith(LINK_PREFIX)))
				.andReturn();
		String token = tokenFrom(result);

		String storedHash = jdbcTemplate.queryForObject(
				"SELECT token_hash FROM invitation WHERE email = ?", String.class, INVITEE);
		Instant expiresAt = jdbcTemplate.queryForObject(
				"SELECT expires_at FROM invitation WHERE email = ?", Instant.class, INVITEE);
		assertThat(storedHash).isEqualTo(sha256Hex(token)).doesNotContain(token);
		assertThat(expiresAt).isBetween(
				Instant.now().plus(Duration.ofDays(7)).minusSeconds(60),
				Instant.now().plus(Duration.ofDays(7)).plusSeconds(60));
	}

	@Test
	void ac5RefusesToInviteAnAddressThatAlreadyHasAnAccount() throws Exception {
		invite(signIn(ADMIN), "Second.Admin@example.com", "USER")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("account_exists"));
	}

	@Test
	void ac5RejectsMalformedInvitations() throws Exception {
		MockHttpSession session = signIn(ADMIN);
		invite(session, "not-an-email", "USER").andExpect(status().isBadRequest());
		invite(session, INVITEE, "EDITOR").andExpect(status().isBadRequest());
	}

	@Test
	void ac6AcceptingCreatesAnAcceptedAccountWithTheInvitedRoleAndAHash() throws Exception {
		String token = tokenFrom(invite(signIn(ADMIN), INVITEE, "ADMIN").andReturn());

		accept(token, PASSWORD).andExpect(status().isNoContent());

		Account account = accountRepository.findByEmailIgnoreCase(INVITEE).orElseThrow();
		assertThat(account.getStatus()).isEqualTo(AccountStatus.ACCEPTED);
		assertThat(account.getRole()).isEqualTo(AccountRole.ADMIN);
		assertThat(account.getPasswordHash()).startsWith("{bcrypt}$2").doesNotContain(PASSWORD);
	}

	@Test
	void ac6RejectsAPasswordThatBreaksThePolicyAndKeepsTheLinkUsable() throws Exception {
		String token = tokenFrom(invite(signIn(ADMIN), INVITEE, "USER").andReturn());

		accept(token, "too short")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("password_rejected"))
				.andExpect(jsonPath("$.violation").value("TOO_SHORT"));
		accept(token, INVITEE)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.violation").value("MATCHES_EMAIL"));
		accept(token, PASSWORD).andExpect(status().isNoContent());
	}

	@Test
	void ac7PendingAccountsSeeOnlyTheirSessionAndGetConfirmationPending() throws Exception {
		accept(tokenFrom(invite(signIn(ADMIN), INVITEE, "USER").andReturn()), PASSWORD);
		MockHttpSession pending = signIn(INVITEE);

		mockMvc.perform(get("/api/session").session(pending))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ACCEPTED"));
		mockMvc.perform(get("/api/elements").session(pending))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("confirmation_pending"));
	}

	@Test
	void ac8AnyAdminConfirmsAndTheRoleAppliesToTheOpenSession() throws Exception {
		accept(tokenFrom(invite(signIn(ADMIN), INVITEE, "USER").andReturn()), PASSWORD);
		MockHttpSession pending = signIn(INVITEE);
		UUID accountId = accountRepository.findByEmailIgnoreCase(INVITEE).orElseThrow().getId();
		MockHttpSession secondAdmin = signIn(SECOND_ADMIN);

		mockMvc.perform(post("/api/admin/accounts/{id}/confirm", accountId).session(secondAdmin).with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/elements").session(pending)).andExpect(status().isOk());
		mockMvc.perform(get("/api/admin/accounts").session(secondAdmin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.email == '%s')].status".formatted(INVITEE)).value("CONFIRMED"));
	}

	@Test
	void ac8ConfirmsOnlyPendingAccounts() throws Exception {
		UUID adminId = accountRepository.findByEmailIgnoreCase(SECOND_ADMIN).orElseThrow().getId();

		mockMvc.perform(post("/api/admin/accounts/{id}/confirm", adminId).session(signIn(ADMIN)).with(csrf()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("account_not_pending"));
	}

	@Test
	void ac9RefusesUsedRevokedExpiredAndUnknownLinksIdentically() throws Exception {
		MockHttpSession admin = signIn(ADMIN);
		String used = tokenFrom(invite(admin, "used@example.com", "USER").andReturn());
		accept(used, PASSWORD).andExpect(status().isNoContent());
		MvcResult revokedInvitation = invite(admin, "revoked@example.com", "USER").andReturn();
		mockMvc.perform(delete("/api/admin/invitations/{id}", idFrom(revokedInvitation)).session(admin).with(csrf()))
				.andExpect(status().isNoContent());
		String expired = tokenFrom(invite(admin, "expired@example.com", "USER").andReturn());
		jdbcTemplate.update("""
				UPDATE invitation
				SET created_at = now() - interval '7 days 1 minute', expires_at = now() - interval '1 minute'
				WHERE email = ?
				""", "expired@example.com");
		entityManager.clear();

		for (String token : List.of(used, tokenFrom(revokedInvitation), expired, "A".repeat(43))) {
			accept(token, PASSWORD)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("invitation_invalid"))
					.andExpect(jsonPath("$.detail").value(INVALID_LINK));
		}
		assertThat(accountRepository.findByEmailIgnoreCase("revoked@example.com")).isEmpty();
		assertThat(accountRepository.findByEmailIgnoreCase("expired@example.com")).isEmpty();
	}

	@Test
	void ac10OffersNoSelfRegistration() throws Exception {
		long accounts = accountRepository.count();
		for (String path : List.of("/api/accounts", "/api/register", "/api/session/register")) {
			mockMvc.perform(post(path).with(csrf())
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"email\":\"self@example.com\",\"password\":\"%s\"}".formatted(PASSWORD)))
					.andExpect(status().isUnauthorized());
		}
		assertThat(accountRepository.count()).isEqualTo(accounts);
	}

	@Test
	void ac19FirstAdminInvitationCreatesAConfirmedAdminOnlyWhileNoAccountExists() throws Exception {
		accountRepository.deleteAllInBatch();
		String first = "first-admin-token-0000000000000000000000000";
		String late = "late-admin-token-00000000000000000000000000";
		invitationRepository.saveAll(List.of(
				Invitation.create("first@example.com", AccountRole.ADMIN, sha256Hex(first), null, Instant.now()),
				Invitation.create("late@example.com", AccountRole.ADMIN, sha256Hex(late), null, Instant.now())
		));
		invitationRepository.flush();

		accept(first, PASSWORD).andExpect(status().isNoContent());
		accept(late, PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("invitation_invalid"));

		Account account = accountRepository.findByEmailIgnoreCase("first@example.com").orElseThrow();
		assertThat(account.getStatus()).isEqualTo(AccountStatus.CONFIRMED);
		assertThat(account.getRole()).isEqualTo(AccountRole.ADMIN);
		assertThat(accountRepository.findByEmailIgnoreCase("late@example.com")).isEmpty();
	}

	@Test
	void ac20LogsTheInvitationLifecycleWithIdsOnly(CapturedOutput output) throws Exception {
		MockHttpSession admin = signIn(ADMIN);
		UUID adminId = accountRepository.findByEmailIgnoreCase(ADMIN).orElseThrow().getId();
		MvcResult invitation = invite(admin, INVITEE, "USER").andReturn();
		String token = tokenFrom(invitation);
		accept(token, PASSWORD);
		UUID accountId = accountRepository.findByEmailIgnoreCase(INVITEE).orElseThrow().getId();
		mockMvc.perform(post("/api/admin/accounts/{id}/confirm", accountId).session(admin).with(csrf()));
		MvcResult revoked = invite(admin, "revoked@example.com", "USER").andReturn();
		mockMvc.perform(delete("/api/admin/invitations/{id}", idFrom(revoked)).session(admin).with(csrf()));

		assertThat(output)
				.contains("Admin " + adminId + " created invitation " + idFrom(invitation) + " for role USER")
				.contains("Invitation " + idFrom(invitation) + " accepted by new account " + accountId)
				.contains("Admin " + adminId + " confirmed account " + accountId)
				.contains("Admin " + adminId + " revoked invitation " + idFrom(revoked))
				.doesNotContain(token)
				.doesNotContain(INVITEE)
				.doesNotContain(PASSWORD);
	}

	private MockHttpSession signIn(String email) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/session/login")
						.param("email", email).param("password", PASSWORD).with(csrf()))
				.andExpect(status().isNoContent())
				.andReturn();
		return (MockHttpSession) result.getRequest().getSession(false);
	}

	private ResultActions invite(MockHttpSession session, String email, String role) throws Exception {
		return mockMvc.perform(post("/api/admin/invitations").session(session).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"role\":\"%s\"}".formatted(email, role)));
	}

	private ResultActions accept(String token, String password) throws Exception {
		return mockMvc.perform(post("/api/invitations/accept").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"%s\",\"password\":\"%s\"}".formatted(token, password)));
	}

	private static String tokenFrom(MvcResult result) throws Exception {
		String link = JsonPath.read(result.getResponse().getContentAsString(), "$.link");
		return link.substring(LINK_PREFIX.length());
	}

	private static String idFrom(MvcResult result) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
	}

	private static String sha256Hex(String value) throws Exception {
		return HexFormat.of().formatHex(
				MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
	}
}
