package com.ituseful.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(
		name = "element_translation",
		uniqueConstraints = @UniqueConstraint(
				name = "element_translation_language_unique",
				columnNames = {"element_id", "language_code"}
		)
)
public class ElementTranslation {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "element_id", nullable = false)
	private Element element;

	@Enumerated(EnumType.STRING)
	@Column(name = "language_code", nullable = false, length = 2)
	private LanguageCode languageCode;

	@Column(nullable = false, length = 255)
	private String title;

	@Column(nullable = false, columnDefinition = "text")
	private String content;

	@Column(columnDefinition = "text")
	private String examples;

	protected ElementTranslation() {
	}

	ElementTranslation(Element element, LanguageCode languageCode, String title, String content, String examples) {
		this.element = element;
		this.languageCode = languageCode;
		this.title = Element.requireText(title, "title");
		this.content = Element.requireText(content, "content");
		this.examples = normalizeOptionalText(examples);
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

	public LanguageCode getLanguageCode() {
		return languageCode;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = Element.requireText(title, "title");
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = Element.requireText(content, "content");
	}

	public String getExamples() {
		return examples;
	}

	public void setExamples(String examples) {
		this.examples = normalizeOptionalText(examples);
	}

	private static String normalizeOptionalText(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
