package com.ituseful.backend.exception;

public class AccountNotPendingException extends RuntimeException {

	public AccountNotPendingException() {
		super("Only an accepted account can be confirmed");
	}
}
