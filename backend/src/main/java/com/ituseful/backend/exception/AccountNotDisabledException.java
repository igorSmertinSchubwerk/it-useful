package com.ituseful.backend.exception;

public class AccountNotDisabledException extends RuntimeException {

	public AccountNotDisabledException() {
		super("Only a disabled account can be enabled");
	}
}
