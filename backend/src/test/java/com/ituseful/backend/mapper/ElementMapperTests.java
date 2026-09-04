package com.ituseful.backend.mapper;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ElementMapperTests {
	private final ElementMapper mapper = new ElementMapper();

	@Test
	void mapsLocalizedTitlesAndSortsDetailContent() {
		Element element = new Element("cache")
				.addTranslation(LanguageCode.RU, "Кэш", "Текст", "Пример")
				.addTranslation(LanguageCode.EN, "Cache", "Content", null)
				.addTranslation(LanguageCode.DE, "Cache DE", "Inhalt", "Beispiel")
				.addImage("second.png", "private-second.png", "image/png", "Second", 2)
				.addImage("first.png", "private-first.png", "image/png", "First", 0);

		var list = mapper.toListResponse(element);
		assertThat(list.slug()).isEqualTo("cache");
		assertThat(list.titles()).containsEntry(LanguageCode.RU, "Кэш")
				.containsEntry(LanguageCode.EN, "Cache").containsEntry(LanguageCode.DE, "Cache DE");
		var detail = mapper.toDetailResponse(element);
		assertThat(detail.translations()).extracting("languageCode")
				.containsExactly(LanguageCode.EN, LanguageCode.DE, LanguageCode.RU);
		assertThat(detail.translations().get(2).examples()).isEqualTo("Пример");
		assertThat(detail.images()).extracting("fileName").containsExactly("first.png", "second.png");
		assertThat(detail.images().getFirst().altText()).isEqualTo("First");
	}

	@Test
	void mapsAnElementWithoutImages() {
		assertThat(mapper.toDetailResponse(new Element("empty")).images()).isEmpty();
	}
}
