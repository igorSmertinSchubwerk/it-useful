package com.ituseful.backend.repository;

import com.ituseful.backend.domain.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {

	Optional<Account> findByEmailIgnoreCase(String email);
}
