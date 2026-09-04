package com.ituseful.backend.service;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import com.ituseful.backend.dto.ElementDetailResponse;
import com.ituseful.backend.dto.ElementTranslationRequest;
import com.ituseful.backend.dto.ElementWriteRequest;
import com.ituseful.backend.exception.DuplicateSlugException;
import com.ituseful.backend.exception.ElementNotFoundException;
import com.ituseful.backend.mapper.ElementMapper;
import com.ituseful.backend.repository.ElementRepository;
import com.ituseful.backend.storage.UploadStorageService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ElementServiceTests {

	private final ElementRepository repository = mock(ElementRepository.class);
	private final ElementMapper mapper = mock(ElementMapper.class);
	private final UploadStorageService storageService = mock(UploadStorageService.class);
	private final ElementService service = new ElementService(repository, mapper, storageService);

	@Test
	void createsAnElementWithANormalizedSlug() {
		ElementWriteRequest request = request("REST-API");
		when(repository.findBySlugIgnoreCase("rest-api")).thenReturn(Optional.empty());
		when(repository.saveAndFlush(any(Element.class))).thenAnswer(invocation -> invocation.getArgument(0));

		service.create(request);

		verify(repository).findBySlugIgnoreCase("rest-api");
		verify(repository).saveAndFlush(org.mockito.ArgumentMatchers.argThat(element ->
				element.getSlug().equals("rest-api") && element.getTranslations().size() == 3
		));
	}

	@Test
	void updatesEveryTranslation() {
		UUID id = UUID.randomUUID();
		Element element = completeElement("old-slug");
		when(repository.findDetailById(id)).thenReturn(Optional.of(element));
		when(repository.findBySlugIgnoreCase("new-slug")).thenReturn(Optional.empty());

		service.update(id, request("NEW-SLUG"));

		verify(repository).flush();
		org.assertj.core.api.Assertions.assertThat(element.getSlug()).isEqualTo("new-slug");
		org.assertj.core.api.Assertions.assertThat(element.getTranslations())
				.allSatisfy(translation -> org.assertj.core.api.Assertions.assertThat(translation.getTitle()).endsWith(" title"));
	}

	@Test
	void rejectsADuplicateSlug() {
		when(repository.findBySlugIgnoreCase("existing")).thenReturn(Optional.of(new Element("existing")));

		assertThatThrownBy(() -> service.create(request("EXISTING")))
				.isInstanceOf(DuplicateSlugException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void reportsAMissingElementForReadAndDelete() {
		UUID id = UUID.randomUUID();
		when(repository.findDetailById(id)).thenReturn(Optional.empty());
		when(repository.findById(id)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.get(id)).isInstanceOf(ElementNotFoundException.class);
		assertThatThrownBy(() -> service.delete(id)).isInstanceOf(ElementNotFoundException.class);
	}

	@Test
	void deletesStoredImageFilesWithTheElement() {
		UUID id = UUID.randomUUID();
		Element element = completeElement("with-image")
				.addImage("diagram.png", "stored-diagram.png", "image/png", "Diagram", 0);
		when(repository.findDetailById(id)).thenReturn(Optional.of(element));

		service.delete(id);

		verify(storageService).delete("stored-diagram.png");
		verify(repository).delete(element);
	}

	private static ElementWriteRequest request(String slug) {
		return new ElementWriteRequest(slug, List.of(
				new ElementTranslationRequest(LanguageCode.EN, "English title", "English content", "English example"),
				new ElementTranslationRequest(LanguageCode.DE, "German title", "German content", "German example"),
				new ElementTranslationRequest(LanguageCode.RU, "Russian title", "Russian content", "Russian example")
		));
	}

	private static Element completeElement(String slug) {
		return new Element(slug)
				.addTranslation(LanguageCode.EN, "Old English", "Old content", null)
				.addTranslation(LanguageCode.DE, "Old German", "Alter Inhalt", null)
				.addTranslation(LanguageCode.RU, "Old Russian", "Старый текст", null);
	}
}
