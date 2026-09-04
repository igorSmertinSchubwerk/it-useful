package com.ituseful.backend.controller;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import com.ituseful.backend.repository.ElementImageRepository;
import com.ituseful.backend.repository.ElementRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import com.ituseful.backend.support.PostgresTestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ElementImageControllerIntegrationTests {

	private static final byte[] PNG = {
			(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
	};
	private static final Path STORAGE_DIRECTORY = createStorageDirectory();

	private final MockMvc mockMvc;
	private final ElementRepository elementRepository;
	private final ElementImageRepository imageRepository;

	@Autowired
	ElementImageControllerIntegrationTests(
			MockMvc mockMvc,
			ElementRepository elementRepository,
			ElementImageRepository imageRepository
	) {
		this.mockMvc = mockMvc;
		this.elementRepository = elementRepository;
		this.imageRepository = imageRepository;
	}

	@DynamicPropertySource
	static void storageProperties(DynamicPropertyRegistry registry) {
		registry.add("app.storage.directory", STORAGE_DIRECTORY::toString);
	}

	@AfterAll
	static void removeStorageDirectory() throws IOException {
		try (var files = Files.list(STORAGE_DIRECTORY)) {
			for (Path file : files.toList()) {
				Files.deleteIfExists(file);
			}
		}
		Files.deleteIfExists(STORAGE_DIRECTORY);
	}

	@Test
	@org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
	void uploadsReadsUpdatesAndDeletesAnImage() throws Exception {
		UUID elementId = elementRepository.saveAndFlush(completeElement("image-api")).getId();
		MockMultipartFile file = new MockMultipartFile("file", "../diagram.png", "image/png", PNG);

		mockMvc.perform(multipart("/api/elements/{elementId}/images", elementId)
					.file(file)
					.param("altText", "Original diagram")
					.param("displayOrder", "0"))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern(".*/api/images/[0-9a-f-]+")))
				.andExpect(jsonPath("$.fileName").value("diagram.png"))
				.andExpect(jsonPath("$.contentType").value("image/png"))
				.andExpect(jsonPath("$.displayOrder").value(0));

		var image = imageRepository.findAllByElementIdOrderByDisplayOrder(elementId).getFirst();
		Path storedPath = STORAGE_DIRECTORY.resolve(image.getStoragePath());
		assertThat(storedPath).isRegularFile();

		mockMvc.perform(get("/api/images/{imageId}", image.getId()))
				.andExpect(status().isOk())
				.andExpect(content().contentType("image/png"))
				.andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("diagram.png")))
				.andExpect(content().bytes(PNG));

		mockMvc.perform(patch("/api/images/{imageId}", image.getId())
					.contentType("application/json")
					.content("{\"altText\":\"Updated diagram\",\"displayOrder\":2}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.altText").value("Updated diagram"))
				.andExpect(jsonPath("$.displayOrder").value(2));

		mockMvc.perform(get("/api/elements/{elementId}", elementId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.images[0].id").value(image.getId().toString()))
				.andExpect(jsonPath("$.images[0].storagePath").doesNotExist());

		mockMvc.perform(delete("/api/images/{imageId}", image.getId()))
				.andExpect(status().isNoContent());
		assertThat(imageRepository.existsById(image.getId())).isFalse();
		assertThat(storedPath).doesNotExist();
		mockMvc.perform(delete("/api/elements/{elementId}", elementId)).andExpect(status().isNoContent());
	}

	@Test
	void deletingAnElementAlsoDeletesItsUploadedFile() throws Exception {
		UUID elementId = elementRepository.saveAndFlush(completeElement("delete-image-parent")).getId();
		mockMvc.perform(multipart("/api/elements/{elementId}/images", elementId)
				.file(new MockMultipartFile("file", "diagram.png", "image/png", PNG)))
				.andExpect(status().isCreated());
		var image = imageRepository.findAllByElementIdOrderByDisplayOrder(elementId).getFirst();
		Path storedPath = STORAGE_DIRECTORY.resolve(image.getStoragePath());
		mockMvc.perform(delete("/api/elements/{elementId}", elementId)).andExpect(status().isNoContent());
		elementRepository.flush();
		assertThat(storedPath).doesNotExist();
		assertThat(imageRepository.existsById(image.getId())).isFalse();
	}

	@Test
	void rejectsAFileWhoseDeclaredTypeDoesNotMatchItsContent() throws Exception {
		UUID elementId = elementRepository.saveAndFlush(completeElement("invalid-image")).getId();
		MockMultipartFile file = new MockMultipartFile("file", "fake.jpg", "image/jpeg", PNG);

		mockMvc.perform(multipart("/api/elements/{elementId}/images", elementId).file(file))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("invalid_image"));
		assertThat(imageRepository.findAllByElementIdOrderByDisplayOrder(elementId)).isEmpty();
	}

	private static Element completeElement(String slug) {
		return new Element(slug)
				.addTranslation(LanguageCode.EN, "English", "English content", null)
				.addTranslation(LanguageCode.DE, "Deutsch", "Deutscher Inhalt", null)
				.addTranslation(LanguageCode.RU, "Русский", "Русский текст", null);
	}

	private static Path createStorageDirectory() {
		try {
			return Files.createTempDirectory("it-useful-images-");
		} catch (IOException exception) {
			throw new ExceptionInInitializerError(exception);
		}
	}
}
