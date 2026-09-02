package com.ituseful.backend.config;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import com.ituseful.backend.repository.ElementRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;

import java.util.List;
import java.util.Set;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalSeedDataInitializerTests {

	@Test
	void createsTwoDefinitionsWithEveryRequiredTranslation() throws Exception {
		ElementRepository repository = mock(ElementRepository.class);
		when(repository.existsBySlugIgnoreCase(anyString())).thenReturn(false);
		LocalSeedDataInitializer initializer = new LocalSeedDataInitializer(repository);

		initializer.run(new DefaultApplicationArguments());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<Iterable<Element>> captor = ArgumentCaptor.forClass(Iterable.class);
		verify(repository).saveAll(captor.capture());
		List<Element> elements = StreamSupport.stream(captor.getValue().spliterator(), false).toList();

		assertThat(elements).extracting(Element::getSlug).containsExactly("api", "database-index");
		assertThat(elements).allSatisfy(element -> {
			assertThat(element.getTranslations()).hasSize(3);
			assertThat(element.getTranslations())
					.extracting(translation -> translation.getLanguageCode())
					.containsExactlyInAnyOrderElementsOf(Set.of(LanguageCode.EN, LanguageCode.DE, LanguageCode.RU));
			assertThat(element.getTranslations()).allSatisfy(translation -> {
				assertThat(translation.getTitle()).isNotBlank();
				assertThat(translation.getContent()).isNotBlank();
				assertThat(translation.getExamples()).isNotBlank();
			});
		});
	}

	@Test
	void doesNotInsertDefinitionsThatAlreadyExist() throws Exception {
		ElementRepository repository = mock(ElementRepository.class);
		when(repository.existsBySlugIgnoreCase(anyString())).thenReturn(true);
		LocalSeedDataInitializer initializer = new LocalSeedDataInitializer(repository);

		initializer.run(new DefaultApplicationArguments());

		verify(repository, never()).saveAll(org.mockito.ArgumentMatchers.any());
	}
}
