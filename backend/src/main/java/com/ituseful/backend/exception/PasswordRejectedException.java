package com.ituseful.backend.exception;

import com.ituseful.backend.security.PasswordViolation;

public class PasswordRejectedException extends RuntimeException {

	private final PasswordViolation violation;

	public PasswordRejectedException(PasswordViolation violation) {
		super("The password does not meet the password rules");
		this.violation = violation;
	}

	public PasswordViolation getViolation() {
		return violation;
	}
}
