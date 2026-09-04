package com.ituseful.backend.service;

import com.ituseful.backend.domain.Element;
import com.ituseful.backend.domain.ElementImage;
import com.ituseful.backend.dto.ElementImageResponse;
import com.ituseful.backend.dto.ElementImageUpdateRequest;
import com.ituseful.backend.exception.DuplicateImageOrderException;
import com.ituseful.backend.exception.ElementNotFoundException;
import com.ituseful.backend.exception.ImageNotFoundException;
import com.ituseful.backend.mapper.ElementMapper;
import com.ituseful.backend.repository.ElementImageRepository;
import com.ituseful.backend.repository.ElementRepository;
import com.ituseful.backend.storage.StoredFile;
import com.ituseful.backend.storage.UploadStorageService;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Comparator;
import java.util.UUID;

@Service
public class ElementImageService {

	private final ElementRepository elementRepository;
	private final ElementImageRepository imageRepository;
	private final UploadStorageService storageService;
	private final ElementMapper elementMapper;

	public ElementImageService(
			ElementRepository elementRepository,
			ElementImageRepository imageRepository,
			UploadStorageService storageService,
			ElementMapper elementMapper
	) {
		this.elementRepository = elementRepository;
		this.imageRepository = imageRepository;
		this.storageService = storageService;
		this.elementMapper = elementMapper;
	}

	@Transactional
	public ElementImageResponse upload(UUID elementId, MultipartFile file, String altText, Integer requestedDisplayOrder) {
		Element element = elementRepository.findDetailById(elementId)
				.orElseThrow(() -> new ElementNotFoundException(elementId));
		int displayOrder = requestedDisplayOrder == null ? nextDisplayOrder(element) : requestedDisplayOrder;
		if (imageRepository.existsByElementIdAndDisplayOrder(elementId, displayOrder)) {
			throw new DuplicateImageOrderException(displayOrder);
		}

		StoredFile storedFile = storageService.store(file);
		try {
			ElementImage image = element.addImageAndReturn(
					storedFile.originalFileName(),
					storedFile.storageName(),
					storedFile.contentType(),
					altText,
					displayOrder
			);
			ElementImage saved = imageRepository.saveAndFlush(image);
			return elementMapper.toImageResponse(saved);
		} catch (RuntimeException exception) {
			storageService.delete(storedFile.storageName());
			throw exception;
		}
	}

	@Transactional(readOnly = true)
	public ImageDownload download(UUID imageId) {
		ElementImage image = findImage(imageId);
		Resource resource = storageService.load(image.getStoragePath());
		return new ImageDownload(resource, image.getFileName(), image.getContentType());
	}

	@Transactional
	public ElementImageResponse update(UUID imageId, ElementImageUpdateRequest request) {
		ElementImage image = findImage(imageId);
		if (request.displayOrder() != null && request.displayOrder() != image.getDisplayOrder()) {
			if (imageRepository.existsByElementIdAndDisplayOrder(image.getElement().getId(), request.displayOrder())) {
				throw new DuplicateImageOrderException(request.displayOrder());
			}
			image.setDisplayOrder(request.displayOrder());
		}
		image.setAltText(request.altText());
		imageRepository.flush();
		return elementMapper.toImageResponse(image);
	}

	@Transactional
	public void delete(UUID imageId) {
		ElementImage image = findImage(imageId);
		storageService.delete(image.getStoragePath());
		image.getElement().removeImage(image);
		elementRepository.flush();
	}

	private ElementImage findImage(UUID imageId) {
		return imageRepository.findById(imageId).orElseThrow(() -> new ImageNotFoundException(imageId));
	}

	private static int nextDisplayOrder(Element element) {
		return element.getImages().stream()
				.max(Comparator.comparingInt(ElementImage::getDisplayOrder))
				.map(image -> image.getDisplayOrder() + 1)
				.orElse(0);
	}

	public record ImageDownload(Resource resource, String fileName, String contentType) {
	}
}
