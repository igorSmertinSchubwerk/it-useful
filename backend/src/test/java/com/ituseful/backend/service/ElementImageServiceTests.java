package com.ituseful.backend.service;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.exception.DuplicateImageOrderException;
import com.ituseful.backend.exception.ElementNotFoundException;
import com.ituseful.backend.exception.ImageNotFoundException;
import com.ituseful.backend.mapper.ElementMapper;
import com.ituseful.backend.repository.ElementImageRepository;
import com.ituseful.backend.repository.ElementRepository;
import com.ituseful.backend.storage.StoredFile;
import com.ituseful.backend.storage.UploadStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ElementImageServiceTests {
	private final ElementRepository elements = mock(ElementRepository.class);
	private final ElementImageRepository images = mock(ElementImageRepository.class);
	private final UploadStorageService storage = mock(UploadStorageService.class);
	private final ElementImageService service = new ElementImageService(elements, images, storage, new ElementMapper());
	private final UUID elementId = UUID.randomUUID();
	private final MockMultipartFile file = new MockMultipartFile("file", "diagram.png", "image/png", new byte[] {1});

	@Test
	void missingElementDoesNotWriteAFile() {
		assertThatThrownBy(() -> service.upload(elementId, file, null, null))
				.isInstanceOf(ElementNotFoundException.class);
		verifyNoInteractions(storage);
	}

	@Test
	void duplicateOrderDoesNotWriteAFile() {
		when(elements.findDetailById(elementId)).thenReturn(Optional.of(new Element("test")));
		when(images.existsByElementIdAndDisplayOrder(elementId, 0)).thenReturn(true);
		assertThatThrownBy(() -> service.upload(elementId, file, null, 0))
				.isInstanceOf(DuplicateImageOrderException.class);
		verifyNoInteractions(storage);
	}

	@Test
	void assignsTheNextOrderAndReturnsMetadata() {
		when(elements.findDetailById(elementId)).thenReturn(Optional.of(new Element("test")
				.addImage("old.png", "old.png", "image/png", null, 3)));
		when(storage.store(file)).thenReturn(new StoredFile("diagram.png", "generated.png", "image/png", 1));
		when(images.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
		var response = service.upload(elementId, file, "Diagram", null);
		assertThat(response.displayOrder()).isEqualTo(4);
		assertThat(response.altText()).isEqualTo("Diagram");
	}

	@Test
	void removesTheFileWhenPersistenceFails() {
		when(elements.findDetailById(elementId)).thenReturn(Optional.of(new Element("test")));
		when(storage.store(file)).thenReturn(new StoredFile("diagram.png", "generated.png", "image/png", 1));
		var failure = new IllegalStateException("Database failure");
		when(images.saveAndFlush(any())).thenThrow(failure);
		assertThatThrownBy(() -> service.upload(elementId, file, null, 0)).isSameAs(failure);
		verify(storage).delete("generated.png");
	}

	@Test
	void missingImageDoesNotAccessStorage() {
		UUID imageId = UUID.randomUUID();
		assertThatThrownBy(() -> service.download(imageId)).isInstanceOf(ImageNotFoundException.class);
		assertThatThrownBy(() -> service.delete(imageId)).isInstanceOf(ImageNotFoundException.class);
		verifyNoInteractions(storage);
	}
}
