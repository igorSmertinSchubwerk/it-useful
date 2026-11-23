package com.ituseful.backend.repository;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.support.PostgresTestConfiguration;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@ActiveProfiles("test")
@Transactional
class AccountRepositoryIntegrationTests {

	private static final String BCRYPT_HASH = "{bcrypt}$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5BWX4Z3ZpeZ1uZ5pZ8m1hS8Wl6s5S";

	private final AccountRepository accountRepository;
	private final EntityManager entityManager;
	private final JdbcTemplate jdbcTemplate;

	@Autowired
	AccountRepositoryIntegrationTests(
			AccountRepository accountRepository,
			EntityManager entityManager,
			JdbcTemplate jdbcTemplate
	) {
		this.accountRepository = accountRepository;
		this.entityManager = entityManager;
		this.jdbcTemplate = jdbcTemplate;
	}

	@Test
	void storesTheEmailLowercasedAndFindsItIgnoringCase() {
		accountRepository.saveAndFlush(new Account("  Ada.Lovelace@Example.com ", BCRYPT_HASH,
				AccountRole.USER, AccountStatus.ACCEPTED));
		entityManager.clear();

		Account loaded = accountRepository.findByEmailIgnoreCase("ADA.LOVELACE@example.com").orElseThrow();

		assertThat(loaded.getEmail()).isEqualTo("ada.lovelace@example.com");
		assertThat(loaded.getRole()).isEqualTo(AccountRole.USER);
		assertThat(loaded.getStatus()).isEqualTo(AccountStatus.ACCEPTED);
	}

	@Test
	void rejectsASecondAccountForTheSameEmail() {
		accountRepository.saveAndFlush(new Account("grace@example.com", BCRYPT_HASH,
				AccountRole.ADMIN, AccountStatus.CONFIRMED));

		assertThatThrownBy(() -> accountRepository.saveAndFlush(new Account("Grace@Example.com", BCRYPT_HASH,
				AccountRole.USER, AccountStatus.ACCEPTED)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void rejectsRolesOutsideTheSpec() {
		assertThatThrownBy(() -> insertRaw("editor@example.com", "EDITOR", "CONFIRMED"))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void rejectsStatusesOutsideTheSpec() {
		assertThatThrownBy(() -> insertRaw("invited@example.com", "USER", "INVITED"))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	private void insertRaw(String email, String role, String status) {
		jdbcTemplate.update(
				"INSERT INTO account (id, email, password_hash, role, status) VALUES (gen_random_uuid(), ?, ?, ?, ?)",
				email, BCRYPT_HASH, role, status);
	}
}
