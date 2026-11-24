package com.ituseful.backend.service;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.dto.AccountSummaryResponse;
import com.ituseful.backend.exception.AccountNotFoundException;
import com.ituseful.backend.exception.AccountNotPendingException;
import com.ituseful.backend.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Profile("server")
public class AccountAdministrationService {

	private static final Logger log = LoggerFactory.getLogger(AccountAdministrationService.class);

	private final AccountRepository accountRepository;

	public AccountAdministrationService(AccountRepository accountRepository) {
		this.accountRepository = accountRepository;
	}

	@Transactional(readOnly = true)
	public List<AccountSummaryResponse> list() {
		return accountRepository.findAllByOrderByCreatedAtAsc().stream()
				.map(account -> new AccountSummaryResponse(account.getId(), account.getEmail(), account.getRole(),
						account.getStatus(), account.getCreatedAt()))
				.toList();
	}

	@Transactional
	public void confirm(String adminEmail, UUID accountId) {
		UUID adminId = accountRepository.findByEmailIgnoreCase(adminEmail).orElseThrow().getId();
		Account account = accountRepository.findById(accountId).orElseThrow(AccountNotFoundException::new);
		if (account.getStatus() != AccountStatus.ACCEPTED) {
			throw new AccountNotPendingException();
		}
		account.confirm();
		log.info("Admin {} confirmed account {}", adminId, account.getId());
	}
}
