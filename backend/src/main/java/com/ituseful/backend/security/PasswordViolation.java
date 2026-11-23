package com.ituseful.backend.security;

/**
 * The first rule a proposed password breaks, in the order the policy checks them.
 */
public enum PasswordViolation {
	TOO_SHORT,
	TOO_LONG,
	MATCHES_EMAIL,
	TOO_COMMON
}
