package com.ituseful.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import com.ituseful.backend.support.PostgresTestConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@ActiveProfiles("test")
class ItUsefulBackendApplicationTests {

	private final JdbcTemplate jdbcTemplate;

	@Autowired
	ItUsefulBackendApplicationTests(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Test
	void contextLoads() throws IOException {
		assertThat(jdbcTemplate.queryForObject("select current_database()", String.class))
				.isEqualTo("it_useful_test");
		int migrations = new PathMatchingResourcePatternResolver()
				.getResources("classpath:db/migration/V*__*.sql").length;
		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from flyway_schema_history where success = true", Integer.class))
				.isEqualTo(migrations);
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
