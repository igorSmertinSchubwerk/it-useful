package com.ituseful.backend.storage;

import com.ituseful.backend.exception.InvalidImageException;
import com.ituseful.backend.exception.StorageException;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class UploadStorageService {

	private static final Map<String, String> EXTENSIONS = Map.of(
			"image/jpeg", ".jpg",
			"image/png", ".png",
			"image/webp", ".webp"
	);

	private final Path root;
	private final long maxFileSizeBytes;

	public UploadStorageService(StorageProperties properties) {
		root = Path.of(properties.directory()).toAbsolutePath().normalize();
		maxFileSizeBytes = properties.maxFileSizeBytes();
		try {
			Files.createDirectories(root);
		} catch (IOException exception) {
			throw new StorageException("Could not initialize upload storage", exception);
		}
	}

	public StoredFile store(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new InvalidImageException("Image file must not be empty");
		}
		if (file.getSize() > maxFileSizeBytes) {
			throw new InvalidImageException("Image file exceeds the configured size limit");
		}

		String detectedContentType = detectContentType(file);
		String declaredContentType = normalizeContentType(file.getContentType());
		if (declaredContentType != null && !declaredContentType.equals(detectedContentType)) {
			throw new InvalidImageException("Declared image type does not match the file content");
		}

		String storageName = UUID.randomUUID() + EXTENSIONS.get(detectedContentType);
		Path target = resolveStorageName(storageName);
		Path temporary = null;
		try {
			temporary = Files.createTempFile(root, ".upload-", ".tmp");
			try (InputStream inputStream = file.getInputStream()) {
				Files.copy(inputStream, temporary, StandardCopyOption.REPLACE_EXISTING);
			}
			moveIntoPlace(temporary, target);
			return new StoredFile(safeOriginalName(file.getOriginalFilename()), storageName, detectedContentType, file.getSize());
		} catch (IOException exception) {
			throw new StorageException("Could not store the uploaded image", exception);
		} finally {
			deleteTemporaryFile(temporary);
		}
	}

	public Resource load(String storageName) {
		Path path = resolveStorageName(storageName);
		if (!Files.isRegularFile(path)) {
			throw new StorageException("Stored image file is missing");
		}
		return new FileSystemResource(path);
	}

	public void delete(String storageName) {
		try {
			Files.deleteIfExists(resolveStorageName(storageName));
		} catch (IOException exception) {
			throw new StorageException("Could not delete the stored image", exception);
		}
	}

	Path resolveStorageName(String storageName) {
		if (storageName == null || storageName.isBlank() || !Path.of(storageName).getFileName().toString().equals(storageName)) {
			throw new StorageException("Invalid stored image path");
		}
		Path resolved = root.resolve(storageName).normalize();
		if (!resolved.startsWith(root)) {
			throw new StorageException("Invalid stored image path");
		}
		return resolved;
	}

	private static String detectContentType(MultipartFile file) {
		byte[] signature = new byte[12];
		int length;
		try (InputStream inputStream = file.getInputStream()) {
			length = inputStream.readNBytes(signature, 0, signature.length);
		} catch (IOException exception) {
			throw new InvalidImageException("Could not inspect the uploaded image");
		}

		if (length >= 3 && unsigned(signature[0]) == 0xFF && unsigned(signature[1]) == 0xD8 && unsigned(signature[2]) == 0xFF) {
			return "image/jpeg";
		}
		if (length >= 8
				&& unsigned(signature[0]) == 0x89 && signature[1] == 'P' && signature[2] == 'N' && signature[3] == 'G'
				&& unsigned(signature[4]) == 0x0D && unsigned(signature[5]) == 0x0A
				&& unsigned(signature[6]) == 0x1A && unsigned(signature[7]) == 0x0A) {
			return "image/png";
		}
		if (length >= 12
				&& signature[0] == 'R' && signature[1] == 'I' && signature[2] == 'F' && signature[3] == 'F'
				&& signature[8] == 'W' && signature[9] == 'E' && signature[10] == 'B' && signature[11] == 'P') {
			return "image/webp";
		}
		throw new InvalidImageException("Only valid JPEG, PNG, and WebP images are supported");
	}

	private static String normalizeContentType(String contentType) {
		if (contentType == null || contentType.isBlank() || contentType.equalsIgnoreCase("application/octet-stream")) {
			return null;
		}
		String normalized = contentType.toLowerCase(Locale.ROOT);
		if (!EXTENSIONS.containsKey(normalized)) {
			throw new InvalidImageException("Only JPEG, PNG, and WebP images are supported");
		}
		return normalized;
	}

	private static String safeOriginalName(String originalFilename) {
		String candidate = originalFilename == null ? "upload" : originalFilename.replace('\\', '/');
		candidate = candidate.substring(candidate.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
		if (candidate.isBlank() || candidate.equals(".") || candidate.equals("..")) {
			candidate = "upload";
		}
		return candidate.length() <= 255 ? candidate : candidate.substring(0, 255);
	}

	private static void moveIntoPlace(Path source, Path target) throws IOException {
		try {
			Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
		} catch (AtomicMoveNotSupportedException exception) {
			Files.move(source, target);
		}
	}

	private static void deleteTemporaryFile(Path temporary) {
		if (temporary == null) {
			return;
		}
		try {
			Files.deleteIfExists(temporary);
		} catch (IOException ignored) {
			// The primary storage exception is more useful than a temporary-file cleanup failure.
		}
	}

	private static int unsigned(byte value) {
		return Byte.toUnsignedInt(value);
	}
}
