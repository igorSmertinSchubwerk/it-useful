package com.ituseful.backend.exception;

public class LastAdminException extends RuntimeException {

	public LastAdminException() {
		super("The last confirmed admin cannot be disabled or demoted");
	}
}
