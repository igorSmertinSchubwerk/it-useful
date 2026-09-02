package com.ituseful.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

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
}
