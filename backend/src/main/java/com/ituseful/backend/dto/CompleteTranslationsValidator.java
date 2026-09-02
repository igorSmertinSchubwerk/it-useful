package com.ituseful.backend.dto;

import com.ituseful.backend.domain.LanguageCode;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class CompleteTranslationsValidator implements ConstraintValidator<CompleteTranslations, List<ElementTranslationRequest>> {

	@Override
	public boolean isValid(List<ElementTranslationRequest> translations, ConstraintValidatorContext context) {
		if (translations == null) {
			return true;
		}

		Set<LanguageCode> languageCodes = new HashSet<>();
		for (ElementTranslationRequest translation : translations) {
			if (translation == null || translation.languageCode() == null || !languageCodes.add(translation.languageCode())) {
				return false;
			}
		}
		return languageCodes.equals(EnumSet.allOf(LanguageCode.class));
	}
}
