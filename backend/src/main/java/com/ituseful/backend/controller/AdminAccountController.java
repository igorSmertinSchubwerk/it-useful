package com.ituseful.backend.controller;

import com.ituseful.backend.dto.AccountSummaryResponse;
import com.ituseful.backend.dto.InvitationRequest;
import com.ituseful.backend.dto.InvitationResponse;
import com.ituseful.backend.dto.OpenInvitationResponse;
import com.ituseful.backend.dto.PasswordResetResponse;
import com.ituseful.backend.dto.RoleChangeRequest;
import com.ituseful.backend.service.AccountAdministrationService;
import com.ituseful.backend.service.AccountPasswordService;
import com.ituseful.backend.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Admin-only account management. The security configuration restricts every
 * `/api/admin/**` route to the `ADMIN` role.
 */
@RestController
@RequestMapping("/api/admin")
@Profile("server")
public class AdminAccountController {

	private final AccountAdministrationService accounts;
	private final InvitationService invitations;
	private final AccountPasswordService passwords;

	public AdminAccountController(
			AccountAdministrationService accounts,
			InvitationService invitations,
			AccountPasswordService passwords
	) {
		this.accounts = accounts;
		this.invitations = invitations;
		this.passwords = passwords;
	}

	@GetMapping("/accounts")
	public List<AccountSummaryResponse> listAccounts() {
		return accounts.list();
	}

	@PostMapping("/accounts/{id}/confirm")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void confirm(@PathVariable UUID id, Authentication admin) {
		accounts.confirm(admin.getName(), id);
	}

	@PutMapping("/accounts/{id}/role")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void changeRole(@PathVariable UUID id, @Valid @RequestBody RoleChangeRequest request, Authentication admin) {
		accounts.changeRole(admin.getName(), id, request.role());
	}

	@PostMapping("/accounts/{id}/disable")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void disable(@PathVariable UUID id, Authentication admin) {
		accounts.disable(admin.getName(), id);
	}

	@PostMapping("/accounts/{id}/enable")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void enable(@PathVariable UUID id, Authentication admin) {
		accounts.enable(admin.getName(), id);
	}

	@PostMapping("/accounts/{id}/password-resets")
	@ResponseStatus(HttpStatus.CREATED)
	public PasswordResetResponse createPasswordReset(@PathVariable UUID id, Authentication admin) {
		return passwords.createReset(admin.getName(), id);
	}

	@GetMapping("/invitations")
	public List<OpenInvitationResponse> listOpenInvitations() {
		return invitations.listOpen();
	}

	@PostMapping("/invitations")
	@ResponseStatus(HttpStatus.CREATED)
	public InvitationResponse invite(@Valid @RequestBody InvitationRequest request, Authentication admin) {
		return invitations.invite(admin.getName(), request);
	}

	@DeleteMapping("/invitations/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void revoke(@PathVariable UUID id, Authentication admin) {
		invitations.revoke(admin.getName(), id);
	}
}
