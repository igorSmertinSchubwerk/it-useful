package com.ituseful.backend.mail;

import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.support.PostgresTestConfiguration;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static com.ituseful.backend.support.AccountFixtures.ADMIN;
import static com.ituseful.backend.support.AccountFixtures.USER;
import static com.ituseful.backend.support.AccountFixtures.confirmed;
import static com.ituseful.backend.support.AccountFixtures.createReset;
import static com.ituseful.backend.support.AccountFixtures.field;
import static com.ituseful.backend.support.AccountFixtures.invite;
import static com.ituseful.backend.support.AccountFixtures.signIn;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.security.public-base-url=https://it-useful.example.ts.net")
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
class LinkEmailDeliveryIntegrationTests {

	private static final GenericContainer<?> MAILPIT = new GenericContainer<>("axllent/mailpit:v1.34.0")
			.withExposedPorts(1025, 8025)
			.waitingFor(Wait.forHttp("/livez").forPort(8025));
	private static final HttpClient HTTP = HttpClient.newHttpClient();

	static {
		MAILPIT.start();
	}

	@DynamicPropertySource
	static void mail(DynamicPropertyRegistry registry) {
		registry.add("app.mail.host", MAILPIT::getHost);
		registry.add("app.mail.port", () -> MAILPIT.getMappedPort(1025));
		registry.add("app.mail.from", () -> "it-useful@mail.test");
		registry.add("app.mail.starttls", () -> "false");
	}

	private final MockMvc mockMvc;
	private final AccountRepository accountRepository;
	private final PasswordEncoder passwordEncoder;

	@Autowired
	LinkEmailDeliveryIntegrationTests(
			MockMvc mockMvc,
			AccountRepository accountRepository,
			PasswordEncoder passwordEncoder
	) {
		this.mockMvc = mockMvc;
		this.accountRepository = accountRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@BeforeEach
	void createAccountsAndEmptyTheMailbox() throws Exception {
		String hash = passwordEncoder.encode(com.ituseful.backend.support.AccountFixtures.PASSWORD);
		accountRepository.saveAll(List.of(confirmed(ADMIN, AccountRole.ADMIN, hash), confirmed(USER, AccountRole.USER, hash)));
		accountRepository.flush();
		HTTP.send(mailpit("/api/v1/messages").DELETE().build(), HttpResponse.BodyHandlers.discarding());
	}

	@Test
	void ac25EmailsTheInvitationLinkAndStillReturnsItToTheAdmin() throws Exception {
		MockHttpSession admin = signIn(mockMvc, ADMIN);

		MvcResult result = invite(mockMvc, admin, "new.person@example.com")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.emailSent").value(true))
				.andReturn();

		String message = onlyMessageTo("new.person@example.com");
		assertThat(JsonPath.<String>read(message, "$.From.Address")).isEqualTo("it-useful@mail.test");
		assertThat(JsonPath.<String>read(message, "$.Subject")).contains("IT Useful");
		assertThat(JsonPath.<String>read(message, "$.Text"))
				.contains(field(result, "$.link"))
				.contains("Einladung")
				.contains("invitation");
	}

	@Test
	void ac25EmailsThePasswordResetLinkToTheAccount() throws Exception {
		MockHttpSession admin = signIn(mockMvc, ADMIN);
		Object userId = accountRepository.findByEmailIgnoreCase(USER).orElseThrow().getId();

		MvcResult result = createReset(mockMvc, admin, userId)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.emailSent").value(true))
				.andReturn();

		assertThat(JsonPath.<String>read(onlyMessageTo(USER), "$.Text")).contains(field(result, "$.link"));
	}

	private static String onlyMessageTo(String address) throws Exception {
		String list = HTTP.send(mailpit("/api/v1/messages").GET().build(), HttpResponse.BodyHandlers.ofString()).body();
		List<String> ids = JsonPath.read(list, "$.messages[?(@.To[0].Address == '%s')].ID".formatted(address));
		assertThat(ids).hasSize(1);
		return HTTP.send(mailpit("/api/v1/message/" + ids.getFirst()).GET().build(),
				HttpResponse.BodyHandlers.ofString()).body();
	}

	private static HttpRequest.Builder mailpit(String path) {
		return HttpRequest.newBuilder(URI.create(
				"http://%s:%d%s".formatted(MAILPIT.getHost(), MAILPIT.getMappedPort(8025), path)));
	}
}
