package com.ituseful.backend.config;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import com.ituseful.backend.repository.ElementRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Profile("local")
public class LocalSeedDataInitializer implements ApplicationRunner {

	private final ElementRepository elementRepository;

	public LocalSeedDataInitializer(ElementRepository elementRepository) {
		this.elementRepository = elementRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		List<Element> missingElements = List.of(createApiElement(), createDatabaseIndexElement()).stream()
				.filter(element -> !elementRepository.existsBySlugIgnoreCase(element.getSlug()))
				.toList();

		if (!missingElements.isEmpty()) {
			elementRepository.saveAll(missingElements);
		}
	}

	private static Element createApiElement() {
		return new Element("api")
				.addTranslation(
						LanguageCode.EN,
						"API",
						"An **Application Programming Interface** defines how software systems exchange data and operations.",
						"A React application requests `GET /api/elements` from a Spring Boot service."
				)
				.addTranslation(
						LanguageCode.DE,
						"API",
						"Eine **Programmierschnittstelle** definiert, wie Softwaresysteme Daten und Funktionen austauschen.",
						"Eine React-Anwendung ruft `GET /api/elements` bei einem Spring-Boot-Dienst auf."
				)
				.addTranslation(
						LanguageCode.RU,
						"API",
						"**Интерфейс программирования приложений** определяет обмен данными и операциями между программными системами.",
						"Приложение React запрашивает `GET /api/elements` у сервиса Spring Boot."
				);
	}

	private static Element createDatabaseIndexElement() {
		return new Element("database-index")
				.addTranslation(
						LanguageCode.EN,
						"Database index",
						"A **database index** is an auxiliary data structure that speeds up reads while adding storage and write overhead.",
						"An index on `lower(slug)` makes case-insensitive element lookup efficient."
				)
				.addTranslation(
						LanguageCode.DE,
						"Datenbankindex",
						"Ein **Datenbankindex** ist eine zusätzliche Datenstruktur, die Lesezugriffe beschleunigt, aber Speicher und Schreibaufwand benötigt.",
						"Ein Index auf `lower(slug)` beschleunigt die Suche unabhängig von Groß- und Kleinschreibung."
				)
				.addTranslation(
						LanguageCode.RU,
						"Индекс базы данных",
						"**Индекс базы данных** — это дополнительная структура данных, ускоряющая чтение ценой памяти и дополнительных операций записи.",
						"Индекс по `lower(slug)` ускоряет поиск элемента без учёта регистра."
				);
	}
}
