package com.ituseful.backend.repository;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import com.ituseful.backend.support.PostgresTestConfiguration;
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
class ElementRepositoryIntegrationTests {

	private final ElementRepository elementRepository;
	private final EntityManager entityManager;
	private final EntityManagerFactory entityManagerFactory;
	private final JdbcTemplate jdbcTemplate;

	@Autowired
	ElementRepositoryIntegrationTests(
			ElementRepository elementRepository,
			EntityManager entityManager,
			EntityManagerFactory entityManagerFactory,
			JdbcTemplate jdbcTemplate
	) {
		this.elementRepository = elementRepository;
		this.entityManager = entityManager;
		this.entityManagerFactory = entityManagerFactory;
		this.jdbcTemplate = jdbcTemplate;
	}

	@Test
	void savesAndLoadsTheCompleteAggregate() {
		Element saved = elementRepository.saveAndFlush(completeElement("dependency-injection"));
		entityManager.clear();

		Element loaded = elementRepository.findDetailById(saved.getId()).orElseThrow();

		assertThat(loaded.getSlug()).isEqualTo("dependency-injection");
		assertThat(loaded.getTranslations()).hasSize(3);
		assertThat(loaded.getImages()).extracting("displayOrder").containsExactly(0, 1);
		assertThat(entityManagerFactory.getPersistenceUnitUtil().isLoaded(loaded, "translations")).isTrue();
		assertThat(entityManagerFactory.getPersistenceUnitUtil().isLoaded(loaded, "images")).isTrue();
	}

	@Test
	void listQueryLoadsTranslationsWithoutLoadingImages() {
		elementRepository.saveAndFlush(completeElement("rest"));
		entityManager.clear();

		Element loaded = elementRepository.findAllWithTranslations().stream()
				.filter(element -> element.getSlug().equals("rest"))
				.findFirst()
				.orElseThrow();

		assertThat(entityManagerFactory.getPersistenceUnitUtil().isLoaded(loaded, "translations")).isTrue();
		assertThat(entityManagerFactory.getPersistenceUnitUtil().isLoaded(loaded, "images")).isFalse();
	}

	@Test
	void slugLookupAndUniquenessAreCaseInsensitive() {
		elementRepository.saveAndFlush(new Element("cache"));

		assertThat(elementRepository.existsBySlugIgnoreCase("CACHE")).isTrue();
		assertThat(elementRepository.findBySlugIgnoreCase("Cache")).isPresent();
		assertThatThrownBy(() -> elementRepository.saveAndFlush(new Element("CACHE")))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void deletingAnElementRemovesTranslationsAndImages() {
		Element saved = elementRepository.saveAndFlush(completeElement("transaction"));
		entityManager.clear();

		elementRepository.deleteById(saved.getId());
		elementRepository.flush();

		assertThat(countRows("element_translation", saved.getId())).isZero();
		assertThat(countRows("element_image", saved.getId())).isZero();
	}

	private long countRows(String tableName, java.util.UUID elementId) {
		Long count = jdbcTemplate.queryForObject(
				"SELECT count(*) FROM " + tableName + " WHERE element_id = ?",
				Long.class,
				elementId
		);
		return count == null ? 0 : count;
	}

	private static Element completeElement(String slug) {
		return new Element(slug)
				.addTranslation(LanguageCode.EN, "English title", "English content", "English example")
				.addTranslation(LanguageCode.DE, "Deutscher Titel", "Deutscher Inhalt", "Deutsches Beispiel")
				.addTranslation(LanguageCode.RU, "Русский заголовок", "Русское содержание", "Русский пример")
				.addImage("first.png", "elements/first.png", "image/png", "First image", 0)
				.addImage("second.webp", "elements/second.webp", "image/webp", "Second image", 1);
	}
}
