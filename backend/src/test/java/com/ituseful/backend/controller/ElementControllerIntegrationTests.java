package com.ituseful.backend.controller;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.LanguageCode;
import com.ituseful.backend.repository.ElementRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ElementControllerIntegrationTests {

	private final MockMvc mockMvc;
	private final ElementRepository elementRepository;

	@Autowired
	ElementControllerIntegrationTests(MockMvc mockMvc, ElementRepository elementRepository) {
		this.mockMvc = mockMvc;
		this.elementRepository = elementRepository;
	}

	@Test
	void supportsTheCompleteCrudFlow() throws Exception {
		mockMvc.perform(post("/api/elements")
					.contentType(MediaType.APPLICATION_JSON)
					.content(validRequest("REST-API", "First")))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern(".*/api/elements/[0-9a-f-]+")))
				.andExpect(jsonPath("$.slug").value("rest-api"))
				.andExpect(jsonPath("$.translations.length()").value(3));

		UUID id = elementRepository.findBySlugIgnoreCase("rest-api").orElseThrow().getId();
		mockMvc.perform(get("/api/elements"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.id == '%s')].titles.EN", id).value("First EN"));

		mockMvc.perform(get("/api/elements/{id}", id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slug").value("rest-api"))
				.andExpect(jsonPath("$.images").isEmpty());

		mockMvc.perform(put("/api/elements/{id}", id)
					.contentType(MediaType.APPLICATION_JSON)
					.content(validRequest("UPDATED-SLUG", "Updated")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slug").value("updated-slug"))
				.andExpect(jsonPath("$.translations[?(@.languageCode == 'DE')].title").value("Updated DE"));

		mockMvc.perform(delete("/api/elements/{id}", id))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/elements/{id}", id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("element_not_found"));
	}

	@Test
	void returnsFieldErrorsForIncompleteTranslations() throws Exception {
		String invalidRequest = """
				{
				  "slug": "invalid slug",
				  "translations": [
				    {"languageCode": "EN", "title": "", "content": "Text"},
				    {"languageCode": "DE", "title": "Titel", "content": ""}
				  ]
				}
				""";

		mockMvc.perform(post("/api/elements")
					.contentType(MediaType.APPLICATION_JSON)
					.content(invalidRequest))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("validation_failed"))
				.andExpect(jsonPath("$.errors[?(@.field == 'slug')]").exists())
				.andExpect(jsonPath("$.errors[?(@.field == 'translations')]").exists())
				.andExpect(jsonPath("$.errors[?(@.field == 'translations[0].title')]").exists())
				.andExpect(jsonPath("$.errors[?(@.field == 'translations[1].content')]").exists());
	}

	@Test
	void returnsConflictForADuplicateSlug() throws Exception {
		mockMvc.perform(post("/api/elements")
					.contentType(MediaType.APPLICATION_JSON)
					.content(validRequest("duplicate", "First")))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/elements")
					.contentType(MediaType.APPLICATION_JSON)
					.content(validRequest("DUPLICATE", "Second")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("duplicate_slug"));
	}

	@Test
	void returnsStableProblemsForMalformedInput() throws Exception {
		mockMvc.perform(post("/api/elements")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{not-json"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("malformed_request"));

		mockMvc.perform(get("/api/elements/not-a-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("malformed_request"));
	}

	@Test
	void detailResponseDoesNotExposeImageStoragePaths() throws Exception {
		Element element = new Element("image-contract")
				.addTranslation(LanguageCode.EN, "EN", "English", null)
				.addTranslation(LanguageCode.DE, "DE", "Deutsch", null)
				.addTranslation(LanguageCode.RU, "RU", "Русский", null)
				.addImage("diagram.png", "private/element/diagram.png", "image/png", "Diagram", 0);
		UUID id = elementRepository.saveAndFlush(element).getId();

		mockMvc.perform(get("/api/elements/{id}", id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.images[0].fileName").value("diagram.png"))
				.andExpect(jsonPath("$.images[0].storagePath").doesNotExist());
	}

	@Test
	void exposesTheCompleteOpenApiContractAndSwaggerUi() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("IT Useful API"))
				.andExpect(jsonPath("$.paths['/api/elements']").exists())
				.andExpect(jsonPath("$.paths['/api/elements/{id}']").exists())
				.andExpect(jsonPath("$.paths['/api/elements/{elementId}/images']").exists())
				.andExpect(jsonPath("$.paths['/api/images/{imageId}']").exists());

		mockMvc.perform(get("/swagger-ui.html"))
				.andExpect(status().is3xxRedirection());
	}

	private static String validRequest(String slug, String titlePrefix) {
		return """
				{
				  "slug": "%s",
				  "translations": [
				    {"languageCode": "EN", "title": "%s EN", "content": "English content", "examples": "English example"},
				    {"languageCode": "DE", "title": "%s DE", "content": "German content", "examples": "German example"},
				    {"languageCode": "RU", "title": "%s RU", "content": "Russian content", "examples": "Russian example"}
				  ]
				}
				""".formatted(slug, titlePrefix, titlePrefix, titlePrefix);
	}
}
