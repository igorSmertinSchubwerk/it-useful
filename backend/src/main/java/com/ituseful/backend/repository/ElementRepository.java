package com.ituseful.backend.repository;

import com.ituseful.backend.domain.Element;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ElementRepository extends JpaRepository<Element, UUID> {

	boolean existsBySlugIgnoreCase(String slug);

	Optional<Element> findBySlugIgnoreCase(String slug);

	@EntityGraph(attributePaths = "translations")
	@Query("select distinct element from Element element order by element.slug")
	List<Element> findAllWithTranslations();

	@EntityGraph(attributePaths = {"translations", "images"})
	@Query("select distinct element from Element element where element.id = :id")
	Optional<Element> findDetailById(@Param("id") UUID id);
}
