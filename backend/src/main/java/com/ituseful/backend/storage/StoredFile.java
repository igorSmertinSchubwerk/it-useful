package com.ituseful.backend.storage;

public record StoredFile(
		String originalFileName,
		String storageName,
		String contentType,
		long size
) {
}
