package com.ituseful.backend.controller;

import com.ituseful.backend.dto.AcceptInvitationRequest;
import com.ituseful.backend.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invitations")
@Profile("server")
public class InvitationController {

	private final InvitationService invitations;

	public InvitationController(InvitationService invitations) {
		this.invitations = invitations;
	}

	@PostMapping("/accept")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void accept(@Valid @RequestBody AcceptInvitationRequest request) {
		invitations.accept(request);
	}
}
