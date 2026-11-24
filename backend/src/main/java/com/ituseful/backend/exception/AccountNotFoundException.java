package com.ituseful.backend.exception;

public class AccountNotFoundException extends RuntimeException {

	public AccountNotFoundException() {
		super("The account does not exist");
	}
}
