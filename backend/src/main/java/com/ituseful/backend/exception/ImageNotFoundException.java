package com.ituseful.backend.exception;

import java.util.UUID;

public class ImageNotFoundException extends RuntimeException {

	public ImageNotFoundException(UUID id) {
		super("Image " + id + " was not found");
	}
}
