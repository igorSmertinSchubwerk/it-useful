package com.ituseful.backend.repository;

import com.ituseful.backend.domain.ElementImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ElementImageRepository extends JpaRepository<ElementImage, UUID> {

	List<ElementImage> findAllByElementIdOrderByDisplayOrder(UUID elementId);

	boolean existsByElementIdAndDisplayOrder(UUID elementId, int displayOrder);
}
