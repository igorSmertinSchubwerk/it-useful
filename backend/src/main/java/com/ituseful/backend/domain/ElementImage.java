package com.ituseful.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
		name = "element_image",
		uniqueConstraints = @UniqueConstraint(
				name = "element_image_order_unique",
				columnNames = {"element_id", "display_order"}
		)
)
public class ElementImage {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "element_id", nullable = false)
	private Element element;

	@Column(name = "file_name", nullable = false, length = 255)
	private String fileName;

	@Column(name = "storage_path", nullable = false, length = 1024)
	private String storagePath;

	@Column(name = "content_type", nullable = false, length = 100)
	private String contentType;

	@Column(name = "alt_text", length = 500)
	private String altText;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected ElementImage() {
	}

	@PrePersist
	void createTimestamp() {
		createdAt = Instant.now();
	}

	ElementImage(
			Element element,
			String fileName,
			String storagePath,
			String contentType,
			String altText,
			int displayOrder
	) {
		if (displayOrder < 0) {
			throw new IllegalArgumentException("displayOrder must not be negative");
		}
		this.element = element;
		this.fileName = Element.requireText(fileName, "fileName");
		this.storagePath = Element.requireText(storagePath, "storagePath");
		this.contentType = Element.requireText(contentType, "contentType");
		this.altText = normalizeOptionalText(altText);
		this.displayOrder = displayOrder;
	}

	void detach() {
		element = null;
	}

	public UUID getId() {
		return id;
	}

	public Element getElement() {
		return element;
	}

	public String getFileName() {
		return fileName;
	}

	public String getStoragePath() {
		return storagePath;
	}

	public String getContentType() {
		return contentType;
	}

	public String getAltText() {
		return altText;
	}

	public void setAltText(String altText) {
		this.altText = normalizeOptionalText(altText);
	}

	public int getDisplayOrder() {
		return displayOrder;
	}

	public void setDisplayOrder(int displayOrder) {
		if (displayOrder < 0) {
			throw new IllegalArgumentException("displayOrder must not be negative");
		}
		this.displayOrder = displayOrder;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	private static String normalizeOptionalText(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
