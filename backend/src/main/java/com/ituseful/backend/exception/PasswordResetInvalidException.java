package com.ituseful.backend.exception;

public class PasswordResetInvalidException extends RuntimeException {

	public PasswordResetInvalidException() {
		super("This password reset link is invalid or has expired");
	}
}
