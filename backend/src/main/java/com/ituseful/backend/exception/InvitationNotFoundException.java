package com.ituseful.backend.exception;

public class InvitationNotFoundException extends RuntimeException {

	public InvitationNotFoundException() {
		super("The invitation does not exist");
	}
}
