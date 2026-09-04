package com.ituseful.backend.controller;

import com.ituseful.backend.dto.ElementDetailResponse;
import com.ituseful.backend.dto.ElementListResponse;
import com.ituseful.backend.dto.ElementWriteRequest;
import com.ituseful.backend.service.ElementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/elements")
@Tag(name = "Elements", description = "Create and manage multilingual IT definitions")
public class ElementController {

	private final ElementService elementService;

	public ElementController(ElementService elementService) {
		this.elementService = elementService;
	}

	@GetMapping
	@Operation(summary = "List all elements with localized titles")
	public List<ElementListResponse> list() {
		return elementService.list();
	}

	@GetMapping("/{id}")
	@Operation(summary = "Read an element with translations and image metadata")
	public ElementDetailResponse get(@PathVariable UUID id) {
		return elementService.get(id);
	}

	@PostMapping
	@Operation(summary = "Create an element")
	public ResponseEntity<ElementDetailResponse> create(@Valid @RequestBody ElementWriteRequest request) {
		ElementDetailResponse created = elementService.create(request);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest()
				.path("/{id}")
				.buildAndExpand(created.id())
				.toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Replace an element's slug and translations")
	public ElementDetailResponse update(@PathVariable UUID id, @Valid @RequestBody ElementWriteRequest request) {
		return elementService.update(id, request);
	}

	@DeleteMapping("/{id}")
	@Operation(summary = "Delete an element and all of its images")
	public ResponseEntity<Void> delete(@PathVariable UUID id) {
		elementService.delete(id);
		return ResponseEntity.noContent().build();
	}
}
