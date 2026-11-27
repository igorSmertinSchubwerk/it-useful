package com.ituseful.backend.exception;

public class ImageLimitException extends RuntimeException {

	public ImageLimitException(int limit) {
		super("An element holds at most " + limit + " images");
	}
}
