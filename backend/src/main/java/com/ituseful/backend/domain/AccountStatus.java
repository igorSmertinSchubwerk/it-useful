package com.ituseful.backend.domain;

/**
 * An account exists once an invitee has set a password. It can read the catalog
 * only after an admin confirms it. Pending invitations live in their own table.
 */
public enum AccountStatus {
	ACCEPTED,
	CONFIRMED,
	DISABLED
}
