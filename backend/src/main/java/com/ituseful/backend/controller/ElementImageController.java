package com.ituseful.backend.controller;

import com.ituseful.backend.dto.ElementImageResponse;
import com.ituseful.backend.dto.ElementImageUpdateRequest;
import com.ituseful.backend.service.ElementImageService;
import com.ituseful.backend.service.ElementImageService.ImageDownload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Validated
@RestController
@Tag(name = "Element images", description = "Upload and manage ordered definition images")
public class ElementImageController {

	private final ElementImageService imageService;

	public ElementImageController(ElementImageService imageService) {
		this.imageService = imageService;
	}

	@PostMapping(path = "/api/elements/{elementId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@Operation(summary = "Upload an image for an element")
	public ResponseEntity<ElementImageResponse> upload(
			@PathVariable UUID elementId,
			@Parameter(description = "JPEG, PNG, or WebP image, up to 10 MiB") @RequestParam MultipartFile file,
			@RequestParam(required = false) @Size(max = 500) String altText,
			@RequestParam(required = false) @PositiveOrZero Integer displayOrder
	) {
		ElementImageResponse created = imageService.upload(elementId, file, altText, displayOrder);
		URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
				.path("/api/images/{id}")
				.buildAndExpand(created.id())
				.toUri();
		return ResponseEntity.created(location).body(created);
	}

	@GetMapping("/api/images/{imageId}")
	@Operation(summary = "Read an uploaded image")
	public ResponseEntity<Resource> download(@PathVariable UUID imageId) {
		ImageDownload download = imageService.download(imageId);
		ContentDisposition disposition = ContentDisposition.inline()
				.filename(download.fileName(), StandardCharsets.UTF_8)
				.build();
		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(download.contentType()))
				.header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
				.body(download.resource());
	}

	@PatchMapping("/api/images/{imageId}")
	@Operation(summary = "Update image alternative text or display order")
	public ElementImageResponse update(
			@PathVariable UUID imageId,
			@Valid @RequestBody ElementImageUpdateRequest request
	) {
		return imageService.update(imageId, request);
	}

	@DeleteMapping("/api/images/{imageId}")
	@Operation(summary = "Delete an image and its stored file")
	public ResponseEntity<Void> delete(@PathVariable UUID imageId) {
		imageService.delete(imageId);
		return ResponseEntity.noContent().build();
	}
}
