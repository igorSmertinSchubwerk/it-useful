package com.ituseful.backend.storage;

import com.ituseful.backend.exception.InvalidImageException;
import com.ituseful.backend.exception.StorageException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UploadStorageServiceTests {

	private static final byte[] PNG = {
			(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
	};

	@TempDir
	Path storageDirectory;

	@Test
	void storesWithAGeneratedNameAndSanitizesTheOriginalName() throws Exception {
		UploadStorageService service = service(1024);
		MockMultipartFile upload = new MockMultipartFile(
				"file", "../private\\diagram.png", "image/png", PNG
		);

		StoredFile stored = service.store(upload);

		assertThat(stored.originalFileName()).isEqualTo("diagram.png");
		assertThat(stored.storageName()).matches("[0-9a-f-]+\\.png");
		assertThat(service.load(stored.storageName()).getContentAsByteArray()).isEqualTo(PNG);
		assertThat(Files.isRegularFile(storageDirectory.resolve(stored.storageName()))).isTrue();

		service.delete(stored.storageName());
		assertThat(storageDirectory.resolve(stored.storageName())).doesNotExist();
	}

	@Test
	void rejectsDisguisedUnsupportedAndOversizedFiles() {
		UploadStorageService service = service(8);

		assertThatThrownBy(() -> service.store(new MockMultipartFile(
				"file", "fake.jpg", "image/jpeg", PNG
		))).isInstanceOf(InvalidImageException.class).hasMessageContaining("does not match");
		assertThatThrownBy(() -> service.store(new MockMultipartFile(
				"file", "large.png", "image/png", new byte[9]
		))).isInstanceOf(InvalidImageException.class).hasMessageContaining("size limit");
	}

	@Test
	void rejectsPathsOutsideTheStorageRoot() {
		UploadStorageService service = service(1024);

		assertThatThrownBy(() -> service.load("../secret.png"))
				.isInstanceOf(StorageException.class)
				.hasMessageContaining("Invalid stored image path");
	}

	private UploadStorageService service(long maxSize) {
		return new UploadStorageService(new StorageProperties(storageDirectory.toString(), maxSize));
	}
}
