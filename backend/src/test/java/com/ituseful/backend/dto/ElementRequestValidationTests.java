package com.ituseful.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import com.ituseful.backend.domain.LanguageCode;
import java.util.List;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class ElementRequestValidationTests {

	private static ValidatorFactory validatorFactory;
	private static Validator validator;

	@BeforeAll
	static void createValidator() {
		validatorFactory = Validation.buildDefaultValidatorFactory();
		validator = validatorFactory.getValidator();
	}

	@AfterAll
	static void closeValidator() {
		validatorFactory.close();
	}

	@Test
	void validatesImageTypeSizeAndDisplayOrder() {
		ElementImageMetadataRequest request = new ElementImageMetadataRequest(
				"image/gif",
				10 * 1024 * 1024L + 1,
				"Alt text",
				-1
		);

		assertThat(validator.validate(request))
				.extracting(violation -> violation.getPropertyPath().toString())
				.containsExactlyInAnyOrder("contentType", "sizeBytes", "displayOrder");
	}

	@Test
	void acceptsExactlyTheThreeLanguages() {
		assertThat(validator.validate(new ElementWriteRequest("rest-api", translations()))).isEmpty();
	}

	@Test
	void rejectsMissingDuplicateAndNullTranslations() {
		var translations = translations();
		for (List<ElementTranslationRequest> invalid : Arrays.asList(
				translations.subList(0, 2),
				List.of(translations.get(0), translations.get(0), translations.get(2)),
				Arrays.asList(translations.get(0), null, translations.get(2)),
				List.<ElementTranslationRequest>of())) {
			assertThat(validator.validate(new ElementWriteRequest("valid", invalid))).isNotEmpty();
		}
		assertThat(validator.validate(new ElementWriteRequest("valid", null))).isNotEmpty();
	}

	@Test
	void rejectsInvalidSlugsAndBlankContent() {
		for (String slug : List.of("", "has space", "-leading", "double--hyphen", "a".repeat(161))) {
			assertThat(validator.validate(new ElementWriteRequest(slug, translations())))
					.extracting(v -> v.getPropertyPath().toString()).contains("slug");
		}
		assertThat(validator.validate(new ElementTranslationRequest(LanguageCode.EN, " ", "", null)))
				.extracting(v -> v.getPropertyPath().toString()).contains("title", "content");
	}

	private static List<ElementTranslationRequest> translations() {
		return Arrays.stream(LanguageCode.values())
				.map(language -> new ElementTranslationRequest(language, "Title", "Content", null)).toList();
	}
}
