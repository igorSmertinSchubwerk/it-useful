package com.ituseful.backend.exception;

public class DuplicateSlugException extends RuntimeException {

	public DuplicateSlugException(String slug) {
		super("An element with slug '" + slug + "' already exists");
	}
}
