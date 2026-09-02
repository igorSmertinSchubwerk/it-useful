package com.ituseful.backend.repository;

import com.ituseful.backend.domain.ElementTranslation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ElementTranslationRepository extends JpaRepository<ElementTranslation, UUID> {

	List<ElementTranslation> findAllByElementIdOrderByLanguageCode(UUID elementId);
}
