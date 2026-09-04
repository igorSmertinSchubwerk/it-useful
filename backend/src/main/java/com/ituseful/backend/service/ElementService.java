package com.ituseful.backend.service;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.dto.ElementDetailResponse;
import com.ituseful.backend.dto.ElementListResponse;
import com.ituseful.backend.dto.ElementTranslationRequest;
import com.ituseful.backend.dto.ElementWriteRequest;
import com.ituseful.backend.exception.DuplicateSlugException;
import com.ituseful.backend.exception.ElementNotFoundException;
import com.ituseful.backend.mapper.ElementMapper;
import com.ituseful.backend.repository.ElementRepository;
import com.ituseful.backend.storage.UploadStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class ElementService {

	private final ElementRepository elementRepository;
	private final ElementMapper elementMapper;
	private final UploadStorageService storageService;

	public ElementService(
			ElementRepository elementRepository,
			ElementMapper elementMapper,
			UploadStorageService storageService
	) {
		this.elementRepository = elementRepository;
		this.elementMapper = elementMapper;
		this.storageService = storageService;
	}

	@Transactional(readOnly = true)
	public List<ElementListResponse> list() {
		return elementRepository.findAllWithTranslations().stream()
				.map(elementMapper::toListResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public ElementDetailResponse get(UUID id) {
		return elementMapper.toDetailResponse(findDetail(id));
	}

	@Transactional
	public ElementDetailResponse create(ElementWriteRequest request) {
		String slug = normalizeSlug(request.slug());
		ensureSlugAvailable(slug, null);

		Element element = new Element(slug);
		request.translations().forEach(translation -> addTranslation(element, translation));
		return elementMapper.toDetailResponse(elementRepository.saveAndFlush(element));
	}

	@Transactional
	public ElementDetailResponse update(UUID id, ElementWriteRequest request) {
		Element element = findDetail(id);
		String slug = normalizeSlug(request.slug());
		ensureSlugAvailable(slug, element);

		element.setSlug(slug);
		request.translations().forEach(translation -> element.updateTranslation(
				translation.languageCode(),
				translation.title(),
				translation.content(),
				translation.examples()
		));
		elementRepository.flush();
		return elementMapper.toDetailResponse(element);
	}

	@Transactional
	public void delete(UUID id) {
		Element element = findDetail(id);
		element.getImages().forEach(image -> storageService.delete(image.getStoragePath()));
		elementRepository.delete(element);
	}

	private Element findDetail(UUID id) {
		return elementRepository.findDetailById(id).orElseThrow(() -> new ElementNotFoundException(id));
	}

	private void ensureSlugAvailable(String slug, Element currentElement) {
		elementRepository.findBySlugIgnoreCase(slug)
				.filter(existing -> currentElement == null || !existing.getId().equals(currentElement.getId()))
				.ifPresent(existing -> {
					throw new DuplicateSlugException(slug);
				});
	}

	private static void addTranslation(Element element, ElementTranslationRequest translation) {
		element.addTranslation(
				translation.languageCode(),
				translation.title(),
				translation.content(),
				translation.examples()
		);
	}

	private static String normalizeSlug(String slug) {
		return slug.trim().toLowerCase(Locale.ROOT);
	}
}
