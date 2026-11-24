package com.ituseful.backend.repository;

import com.ituseful.backend.domain.Invitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {

	Optional<Invitation> findByTokenHash(String tokenHash);
}
