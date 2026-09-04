package com.ituseful.backend.mapper;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.ElementImage;
import com.ituseful.backend.domain.ElementTranslation;
import com.ituseful.backend.domain.LanguageCode;
import com.ituseful.backend.dto.ElementDetailResponse;
import com.ituseful.backend.dto.ElementImageResponse;
import com.ituseful.backend.dto.ElementListResponse;
import com.ituseful.backend.dto.ElementTranslationResponse;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;

@Component
public class ElementMapper {

	public ElementListResponse toListResponse(Element element) {
		var titles = new EnumMap<LanguageCode, String>(LanguageCode.class);
		element.getTranslations().forEach(translation -> titles.put(translation.getLanguageCode(), translation.getTitle()));
		return new ElementListResponse(element.getId(), element.getSlug(), titles, element.getUpdatedAt());
	}

	public ElementDetailResponse toDetailResponse(Element element) {
		List<ElementTranslationResponse> translations = element.getTranslations().stream()
				.sorted(Comparator.comparing(ElementTranslation::getLanguageCode))
				.map(this::toTranslationResponse)
				.toList();
		List<ElementImageResponse> images = element.getImages().stream()
				.sorted(Comparator.comparingInt(ElementImage::getDisplayOrder))
				.map(this::toImageResponse)
				.toList();
		return new ElementDetailResponse(
				element.getId(),
				element.getSlug(),
				translations,
				images,
				element.getCreatedAt(),
				element.getUpdatedAt()
		);
	}

	private ElementTranslationResponse toTranslationResponse(ElementTranslation translation) {
		return new ElementTranslationResponse(
				translation.getLanguageCode(),
				translation.getTitle(),
				translation.getContent(),
				translation.getExamples()
		);
	}

	public ElementImageResponse toImageResponse(ElementImage image) {
		return new ElementImageResponse(
				image.getId(),
				image.getFileName(),
				image.getContentType(),
				image.getAltText(),
				image.getDisplayOrder(),
				image.getCreatedAt()
		);
	}
}
