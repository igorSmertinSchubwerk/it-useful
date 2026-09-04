package com.ituseful.backend.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "element")
public class Element {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, length = 160)
	private String slug;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@OneToMany(mappedBy = "element", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("languageCode ASC")
	private Set<ElementTranslation> translations = new LinkedHashSet<>();

	@OneToMany(mappedBy = "element", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("displayOrder ASC")
	private Set<ElementImage> images = new LinkedHashSet<>();

	protected Element() {
	}

	public Element(String slug) {
		this.slug = requireText(slug, "slug");
	}

	@PrePersist
	void createTimestamps() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void updateTimestamp() {
		updatedAt = Instant.now();
	}

	public Element addTranslation(LanguageCode languageCode, String title, String content, String examples) {
		Objects.requireNonNull(languageCode, "languageCode must not be null");
		if (translations.stream().anyMatch(translation -> translation.getLanguageCode() == languageCode)) {
			throw new IllegalArgumentException("A translation for " + languageCode + " already exists");
		}
		translations.add(new ElementTranslation(this, languageCode, title, content, examples));
		return this;
	}

	public void updateTranslation(LanguageCode languageCode, String title, String content, String examples) {
		ElementTranslation translation = translations.stream()
				.filter(candidate -> candidate.getLanguageCode() == languageCode)
				.findFirst()
				.orElseThrow(() -> new IllegalArgumentException("No translation exists for " + languageCode));
		translation.setTitle(title);
		translation.setContent(content);
		translation.setExamples(examples);
	}

	public Element addImage(String fileName, String storagePath, String contentType, String altText, int displayOrder) {
		addImageAndReturn(fileName, storagePath, contentType, altText, displayOrder);
		return this;
	}

	public ElementImage addImageAndReturn(
			String fileName,
			String storagePath,
			String contentType,
			String altText,
			int displayOrder
	) {
		if (images.stream().anyMatch(image -> image.getDisplayOrder() == displayOrder)) {
			throw new IllegalArgumentException("Image display order " + displayOrder + " already exists");
		}
		ElementImage image = new ElementImage(this, fileName, storagePath, contentType, altText, displayOrder);
		images.add(image);
		return image;
	}

	public void removeTranslation(ElementTranslation translation) {
		translations.remove(translation);
		translation.detach();
	}

	public void removeImage(ElementImage image) {
		images.remove(image);
		image.detach();
	}

	public UUID getId() {
		return id;
	}

	public String getSlug() {
		return slug;
	}

	public void setSlug(String slug) {
		this.slug = requireText(slug, "slug");
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public Set<ElementTranslation> getTranslations() {
		return Set.copyOf(translations);
	}

	public List<ElementImage> getImages() {
		return List.copyOf(images);
	}

	static String requireText(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(fieldName + " must not be blank");
		}
		return value.trim();
	}
}
