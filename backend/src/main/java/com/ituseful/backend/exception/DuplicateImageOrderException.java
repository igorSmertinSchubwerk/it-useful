package com.ituseful.backend.exception;

public class DuplicateImageOrderException extends RuntimeException {

	public DuplicateImageOrderException(int displayOrder) {
		super("Image display order " + displayOrder + " is already in use");
	}
}
