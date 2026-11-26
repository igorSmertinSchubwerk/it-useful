package com.ituseful.backend.config;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.security.InvitationTokens;
import com.ituseful.backend.support.PostgresTestConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.security.public-base-url=https://it-useful.example.ts.net")
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
class RememberMeIntegrationTests {

	private static final String PASSWORD = "correct horse battery staple";
	private static final String ADMIN = "admin@example.com";
	private static final String USER = "reader@example.com";
	private static final String COOKIE = "IT_USEFUL_REMEMBER_ME";

	private final MockMvc mockMvc;
	private final Environment environment;
	private final AccountRepository accountRepository;
	private final PasswordEncoder passwordEncoder;
	private final JdbcTemplate jdbcTemplate;

	@Autowired
	RememberMeIntegrationTests(
			MockMvc mockMvc,
			Environment environment,
			AccountRepository accountRepository,
			PasswordEncoder passwordEncoder,
			JdbcTemplate jdbcTemplate
	) {
		this.mockMvc = mockMvc;
		this.environment = environment;
		this.accountRepository = accountRepository;
		this.passwordEncoder = passwordEncoder;
		this.jdbcTemplate = jdbcTemplate;
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
	void endsAnIdleSessionAfterOneHour() {
		assertThat(environment.getProperty("server.servlet.session.timeout", Duration.class))
				.isEqualTo(Duration.ofHours(1));
	}

	@Test
	void setsA30DayCookieOnlyWhenTheSignInAsksForIt() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);
		assertThat(remembered).isNotNull();
		assertThat(remembered.getMaxAge()).isEqualTo((int) Duration.ofDays(30).toSeconds());
		assertThat(remembered.getSecure()).isTrue();
		assertThat(remembered.isHttpOnly()).isTrue();
		assertThat(remembered.getAttribute("SameSite")).isEqualTo("Lax");

		assertThat(signIn(USER, false).getResponse().getCookie(COOKIE)).isNull();
	}

	@Test
	void theCookieSignsInAgainWhenTheSessionIsGone() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);

		MvcResult restored = mockMvc.perform(get("/api/session").cookie(remembered))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(USER))
				.andExpect(jsonPath("$.csrf.token").isNotEmpty())
				.andReturn();

		MockHttpSession session = (MockHttpSession) restored.getRequest().getSession(false);
		mockMvc.perform(get("/api/elements").session(session)).andExpect(status().isOk());
	}

	@Test
	void signingOutEndsThe30DayLogin() throws Exception {
		MvcResult signedIn = signIn(USER, true);
		Cookie remembered = signedIn.getResponse().getCookie(COOKIE);

		mockMvc.perform(post("/logout")
						.session((MockHttpSession) signedIn.getRequest().getSession(false))
						.cookie(remembered)
						.with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/session").cookie(remembered)).andExpect(status().isUnauthorized());
	}

	@Test
	void changingThePasswordEndsThe30DayLoginOnOtherBrowsers() throws Exception {
		Cookie otherBrowser = signIn(USER, true).getResponse().getCookie(COOKIE);
		MvcResult current = signIn(USER, false);

		mockMvc.perform(post("/api/session/password")
						.session((MockHttpSession) current.getRequest().getSession(false))
						.contentType("application/json")
						.content("""
								{"currentPassword": "%s", "newPassword": "a different long passphrase 42"}
								""".formatted(PASSWORD))
						.with(csrf()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/session").cookie(otherBrowser)).andExpect(status().isUnauthorized());
	}

	@Test
	void disablingAndEnablingAnAccountDoesNotRevive30DayLogins() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);
		MockHttpSession admin = (MockHttpSession) signIn(ADMIN, false).getRequest().getSession(false);
		String userId = accountRepository.findByEmailIgnoreCase(USER).orElseThrow().getId().toString();

		mockMvc.perform(post("/api/admin/accounts/{id}/disable", userId).session(admin).with(csrf()))
				.andExpect(status().is2xxSuccessful());
		mockMvc.perform(post("/api/admin/accounts/{id}/enable", userId).session(admin).with(csrf()))
				.andExpect(status().is2xxSuccessful());

		mockMvc.perform(get("/api/session").cookie(remembered)).andExpect(status().isUnauthorized());
	}

	@Test
	void aSessionRestoredFromTheCookieEndsWhenTheAccountIsDisabled() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);
		MockHttpSession restored = (MockHttpSession) mockMvc.perform(get("/api/session").cookie(remembered))
				.andExpect(status().isOk())
				.andReturn().getRequest().getSession(false);
		MockHttpSession admin = (MockHttpSession) signIn(ADMIN, false).getRequest().getSession(false);
		String userId = accountRepository.findByEmailIgnoreCase(USER).orElseThrow().getId().toString();

		mockMvc.perform(post("/api/admin/accounts/{id}/disable", userId).session(admin).with(csrf()))
				.andExpect(status().is2xxSuccessful());

		mockMvc.perform(get("/api/elements").session(restored)).andExpect(status().isUnauthorized());
	}

	@Test
	void theSameCookieKeepsWorkingForRequestsThatOverlap() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);

		MvcResult first = mockMvc.perform(get("/api/session").cookie(remembered))
				.andExpect(status().isOk())
				.andReturn();
		mockMvc.perform(get("/api/elements").cookie(remembered)).andExpect(status().isOk());

		assertThat(first.getResponse().getCookie(COOKIE)).isNull();
	}

	@Test
	void aLoginOlderThan30DaysNoLongerSignsIn() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);
		jdbcTemplate.update("update persistent_logins set last_used = now() - interval '31 days'");

		mockMvc.perform(get("/api/session").cookie(remembered)).andExpect(status().isUnauthorized());
	}

	@Test
	void storesOnlyAHashOfTheCookieToken() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);
		String[] seriesAndToken = Arrays.stream(
						new String(Base64.getDecoder().decode(remembered.getValue())).split(":"))
				.map(part -> URLDecoder.decode(part, StandardCharsets.UTF_8))
				.toArray(String[]::new);

		String stored = jdbcTemplate.queryForObject(
				"select token from persistent_logins where series = ?", String.class, seriesAndToken[0]);

		assertThat(stored).isEqualTo(InvitationTokens.hash(seriesAndToken[1]));
	}

	@Test
	void aPasswordLockoutDoesNotEndThe30DayLogin() throws Exception {
		Cookie remembered = signIn(USER, true).getResponse().getCookie(COOKIE);
		for (int attempt = 0; attempt < 5; attempt++) {
			mockMvc.perform(post("/api/session/login")
							.param("email", USER)
							.param("password", "wrong horse battery staple")
							.with(csrf()))
					.andExpect(status().isUnauthorized());
		}

		mockMvc.perform(get("/api/session").cookie(remembered))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(USER));
	}

	private MvcResult signIn(String email, boolean remember) throws Exception {
		var request = post("/api/session/login")
				.param("email", email)
				.param("password", PASSWORD)
				.with(csrf());
		if (remember) {
			request.param("remember-me", "on");
		}
		return mockMvc.perform(request).andExpect(status().isNoContent()).andReturn();
	}
}
