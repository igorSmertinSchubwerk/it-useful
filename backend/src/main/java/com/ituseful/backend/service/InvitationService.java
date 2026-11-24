package com.ituseful.backend.service;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountStatus;
import com.ituseful.backend.domain.Invitation;
import com.ituseful.backend.dto.AcceptInvitationRequest;
import com.ituseful.backend.dto.InvitationRequest;
import com.ituseful.backend.dto.InvitationResponse;
import com.ituseful.backend.dto.OpenInvitationResponse;
import com.ituseful.backend.exception.AccountExistsException;
import com.ituseful.backend.exception.InvitationInvalidException;
import com.ituseful.backend.exception.InvitationNotFoundException;
import com.ituseful.backend.exception.PasswordRejectedException;
import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.repository.InvitationRepository;
import com.ituseful.backend.security.InvitationTokens;
import com.ituseful.backend.security.PasswordPolicy;
import com.ituseful.backend.security.ServerSecurityProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Creates, revokes, and redeems invitation links. Logs name invitations and
 * accounts by id only, never by email address, token, or password.
 */
@Service
@Profile("server")
public class InvitationService {

	private static final Logger log = LoggerFactory.getLogger(InvitationService.class);

	private final InvitationRepository invitationRepository;
	private final AccountRepository accountRepository;
	private final InvitationTokens tokens;
	private final PasswordPolicy passwordPolicy;
	private final PasswordEncoder passwordEncoder;
	private final ServerSecurityProperties properties;
	private final Clock clock;

	public InvitationService(
			InvitationRepository invitationRepository,
			AccountRepository accountRepository,
			InvitationTokens tokens,
			PasswordPolicy passwordPolicy,
			PasswordEncoder passwordEncoder,
			ServerSecurityProperties properties,
			Clock clock
	) {
		this.invitationRepository = invitationRepository;
		this.accountRepository = accountRepository;
		this.tokens = tokens;
		this.passwordPolicy = passwordPolicy;
		this.passwordEncoder = passwordEncoder;
		this.properties = properties;
		this.clock = clock;
	}

	@Transactional
	public InvitationResponse invite(String adminEmail, InvitationRequest request) {
		UUID adminId = accountRepository.findByEmailIgnoreCase(adminEmail).orElseThrow().getId();
		String email = request.email().trim().toLowerCase(Locale.ROOT);
		if (accountRepository.findByEmailIgnoreCase(email).isPresent()) {
			throw new AccountExistsException();
		}
		String token = tokens.generate();
		Invitation invitation = invitationRepository.saveAndFlush(
				Invitation.create(email, request.role(), InvitationTokens.hash(token), adminId, clock.instant()));
		log.info("Admin {} created invitation {} for role {}", adminId, invitation.getId(), invitation.getRole());
		return new InvitationResponse(invitation.getId(), invitation.getEmail(), invitation.getRole(),
				invitation.getExpiresAt(), properties.publicOrigin() + "/accept-invitation#" + token);
	}

	@Transactional(readOnly = true)
	public List<OpenInvitationResponse> listOpen() {
		return invitationRepository
				.findAllByAcceptedAtIsNullAndRevokedAtIsNullAndExpiresAtAfterOrderByExpiresAtAsc(clock.instant())
				.stream()
				.map(invitation -> new OpenInvitationResponse(invitation.getId(), invitation.getEmail(),
						invitation.getRole(), invitation.getExpiresAt()))
				.toList();
	}

	@Transactional
	public void revoke(String adminEmail, UUID invitationId) {
		UUID adminId = accountRepository.findByEmailIgnoreCase(adminEmail).orElseThrow().getId();
		Invitation invitation = invitationRepository.findById(invitationId)
				.orElseThrow(InvitationNotFoundException::new);
		invitation.revoke(clock.instant());
		log.info("Admin {} revoked invitation {}", adminId, invitation.getId());
	}

	/**
	 * Creates the invitee's account. The first-admin invitation is redeemable only
	 * while no account exists, and its account is confirmed at once because no
	 * admin exists yet to confirm it.
	 */
	@Transactional
	public void accept(AcceptInvitationRequest request) {
		Instant now = clock.instant();
		Invitation invitation = invitationRepository.findByTokenHash(InvitationTokens.hash(request.token()))
				.filter(candidate -> candidate.isUsableAt(now))
				.filter(candidate -> !candidate.isBootstrap() || accountRepository.count() == 0)
				.filter(candidate -> accountRepository.findByEmailIgnoreCase(candidate.getEmail()).isEmpty())
				.orElseThrow(InvitationInvalidException::new);
		passwordPolicy.check(invitation.getEmail(), request.password()).ifPresent(violation -> {
			throw new PasswordRejectedException(violation);
		});
		AccountStatus status = invitation.isBootstrap() ? AccountStatus.CONFIRMED : AccountStatus.ACCEPTED;
		Account account = accountRepository.save(new Account(invitation.getEmail(),
				passwordEncoder.encode(request.password()), invitation.getRole(), status));
		invitation.markAccepted(now);
		log.info("Invitation {} accepted by new account {}", invitation.getId(), account.getId());
	}
}
