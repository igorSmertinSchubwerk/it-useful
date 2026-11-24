package com.ituseful.backend.exception;

public class AccountExistsException extends RuntimeException {

	public AccountExistsException() {
		super("An account with this email address already exists");
	}
}
