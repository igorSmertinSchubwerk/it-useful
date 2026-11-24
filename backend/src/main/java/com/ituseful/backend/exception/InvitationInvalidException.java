package com.ituseful.backend.exception;

public class InvitationInvalidException extends RuntimeException {

	public InvitationInvalidException() {
		super("This invitation link is invalid or has expired");
	}
}
