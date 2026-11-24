package com.ituseful.backend.mail;

import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.support.AccountFixtures;
import com.ituseful.backend.support.PostgresTestConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static com.ituseful.backend.support.AccountFixtures.ADMIN;
import static com.ituseful.backend.support.AccountFixtures.confirmed;
import static com.ituseful.backend.support.AccountFixtures.invite;
import static com.ituseful.backend.support.AccountFixtures.signIn;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.security.public-base-url=https://it-useful.example.ts.net")
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "server"})
@Transactional
class LinkEmailDisabledIntegrationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccountRepository accountRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void ac25SendsNothingWhenNoMailServerIsConfigured() throws Exception {
		accountRepository.saveAndFlush(confirmed(ADMIN, AccountRole.ADMIN, passwordEncoder.encode(AccountFixtures.PASSWORD)));

		invite(mockMvc, signIn(mockMvc, ADMIN), "new.person@example.com")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.emailSent").value(false))
				.andExpect(jsonPath("$.link").isNotEmpty());
	}
}
