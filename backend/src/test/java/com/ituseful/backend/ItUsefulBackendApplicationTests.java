package com.ituseful.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ItUsefulBackendApplicationTests {

	private final JdbcTemplate jdbcTemplate;

	@Autowired
	ItUsefulBackendApplicationTests(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Test
	void contextLoads() {
	}

	@Test
	void flywayCreatesTheInitialTables() {
		Integer tableCount = jdbcTemplate.queryForObject("""
				SELECT count(*)
				FROM information_schema.tables
				WHERE table_schema = 'public'
				  AND table_name IN ('element', 'element_translation', 'element_image')
				""", Integer.class);

		assertThat(tableCount).isEqualTo(3);
	}

}
