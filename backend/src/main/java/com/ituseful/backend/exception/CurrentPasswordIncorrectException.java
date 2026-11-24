package com.ituseful.backend.exception;

public class CurrentPasswordIncorrectException extends RuntimeException {

	public CurrentPasswordIncorrectException() {
		super("The current password is incorrect");
	}
}
