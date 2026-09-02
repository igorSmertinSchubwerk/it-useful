package com.ituseful.backend.exception;

import java.util.UUID;

public class ElementNotFoundException extends RuntimeException {

	public ElementNotFoundException(UUID id) {
		super("Element " + id + " was not found");
	}
}
