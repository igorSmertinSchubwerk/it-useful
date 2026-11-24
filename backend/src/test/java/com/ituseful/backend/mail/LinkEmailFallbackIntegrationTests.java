package com.ituseful.backend.mail;

import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.support.AccountFixtures;
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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static com.ituseful.backend.support.AccountFixtures.ADMIN;
import static com.ituseful.backend.support.AccountFixtures.USER;
import static com.ituseful.backend.support.AccountFixtures.confirmed;
import static com.ituseful.backend.support.AccountFixtures.createReset;
import static com.ituseful.backend.support.AccountFixtures.field;
import static com.ituseful.backend.support.AccountFixtures.invite;
import static com.ituseful.backend.support.AccountFixtures.signIn;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Points the mailer at a port where nothing listens, so every send fails.
 */
@SpringBootTest(properties = {
		"app.security.public-base-url=https://it-useful.example.ts.net",
		"app.mail.host=127.0.0.1",
		"app.mail.port=9",
		"app.mail.from=it-useful@mail.test",
		"app.mail.starttls=false"
})
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class LinkEmailFallbackIntegrationTests {

	private final MockMvc mockMvc;
	private final AccountRepository accountRepository;
	private final PasswordEncoder passwordEncoder;

	@Autowired
	LinkEmailFallbackIntegrationTests(
			MockMvc mockMvc,
			AccountRepository accountRepository,
			PasswordEncoder passwordEncoder
	) {
		this.mockMvc = mockMvc;
		this.accountRepository = accountRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@BeforeEach
	void createAccounts() {
		String hash = passwordEncoder.encode(AccountFixtures.PASSWORD);
		accountRepository.saveAll(List.of(confirmed(ADMIN, AccountRole.ADMIN, hash), confirmed(USER, AccountRole.USER, hash)));
		accountRepository.flush();
	}

	@Test
	void ac26ReturnsBothLinksAndWarnsWithIdsWhenEmailFails(CapturedOutput output) throws Exception {
		MockHttpSession admin = signIn(mockMvc, ADMIN);
		Object userId = accountRepository.findByEmailIgnoreCase(USER).orElseThrow().getId();

		MvcResult invitation = invite(mockMvc, admin, "new.person@example.com")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.emailSent").value(false))
				.andExpect(jsonPath("$.link", startsWith("https://it-useful.example.ts.net/accept-invitation#")))
				.andReturn();
		MvcResult reset = createReset(mockMvc, admin, userId)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.emailSent").value(false))
				.andExpect(jsonPath("$.link", startsWith("https://it-useful.example.ts.net/reset-password#")))
				.andReturn();

		assertThat(output)
				.contains("Email for invitation " + field(invitation, "$.id") + " could not be sent")
				.contains("Email for password reset " + field(reset, "$.id") + " could not be sent")
				.doesNotContain("new.person@example.com")
				.doesNotContain(USER);
	}
}
