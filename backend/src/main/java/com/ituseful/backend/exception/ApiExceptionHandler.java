package com.ituseful.backend.exception;

import com.ituseful.backend.dto.ValidationErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestControllerAdvice
public class ApiExceptionHandler {

	private static final Logger LOGGER = LoggerFactory.getLogger(ApiExceptionHandler.class);

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
		List<ValidationErrorResponse> violations = exception.getBindingResult().getFieldErrors().stream()
				.map(error -> new ValidationErrorResponse(error.getField(), error.getDefaultMessage()))
				.sorted(java.util.Comparator.comparing(ValidationErrorResponse::field))
				.toList();
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Validation failed", "validation_failed", request);
		problem.setProperty("errors", violations);
		return ResponseEntity.badRequest().body(problem);
	}

	@ExceptionHandler(ConstraintViolationException.class)
	ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException exception, HttpServletRequest request) {
		List<ValidationErrorResponse> violations = exception.getConstraintViolations().stream()
				.map(violation -> new ValidationErrorResponse(violation.getPropertyPath().toString(), violation.getMessage()))
				.sorted(java.util.Comparator.comparing(ValidationErrorResponse::field))
				.toList();
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Validation failed", "validation_failed", request);
		problem.setProperty("errors", violations);
		return ResponseEntity.badRequest().body(problem);
	}

	@ExceptionHandler({
			HttpMessageNotReadableException.class,
			MethodArgumentTypeMismatchException.class,
			MissingServletRequestPartException.class,
			MissingServletRequestParameterException.class,
			MultipartException.class
	})
	ResponseEntity<ProblemDetail> handleMalformedRequest(Exception exception, HttpServletRequest request) {
		return response(HttpStatus.BAD_REQUEST, "Malformed request", "malformed_request", request);
	}

	@ExceptionHandler(ElementNotFoundException.class)
	ResponseEntity<ProblemDetail> handleNotFound(ElementNotFoundException exception, HttpServletRequest request) {
		return response(HttpStatus.NOT_FOUND, exception.getMessage(), "element_not_found", request);
	}

	@ExceptionHandler(ImageNotFoundException.class)
	ResponseEntity<ProblemDetail> handleImageNotFound(ImageNotFoundException exception, HttpServletRequest request) {
		return response(HttpStatus.NOT_FOUND, exception.getMessage(), "image_not_found", request);
	}

	@ExceptionHandler(InvalidImageException.class)
	ResponseEntity<ProblemDetail> handleInvalidImage(InvalidImageException exception, HttpServletRequest request) {
		return response(HttpStatus.BAD_REQUEST, exception.getMessage(), "invalid_image", request);
	}

	@ExceptionHandler(DuplicateSlugException.class)
	ResponseEntity<ProblemDetail> handleDuplicateSlug(DuplicateSlugException exception, HttpServletRequest request) {
		return response(HttpStatus.CONFLICT, exception.getMessage(), "duplicate_slug", request);
	}

	@ExceptionHandler(DuplicateImageOrderException.class)
	ResponseEntity<ProblemDetail> handleDuplicateImageOrder(
			DuplicateImageOrderException exception,
			HttpServletRequest request
	) {
		return response(HttpStatus.CONFLICT, exception.getMessage(), "duplicate_image_order", request);
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	ResponseEntity<ProblemDetail> handleConflict(DataIntegrityViolationException exception, HttpServletRequest request) {
		return response(HttpStatus.CONFLICT, "The request conflicts with existing data", "data_conflict", request);
	}

	@ExceptionHandler(MaxUploadSizeExceededException.class)
	ResponseEntity<ProblemDetail> handleLargeUpload(MaxUploadSizeExceededException exception, HttpServletRequest request) {
		return response(HttpStatus.CONTENT_TOO_LARGE, "The uploaded file is too large", "upload_too_large", request);
	}

	@ExceptionHandler(StorageException.class)
	ResponseEntity<ProblemDetail> handleStorageFailure(StorageException exception, HttpServletRequest request) {
		LOGGER.error("Image storage failure", exception);
		return response(HttpStatus.INTERNAL_SERVER_ERROR, "Image storage operation failed", "storage_error", request);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ProblemDetail> handleUnexpected(Exception exception, HttpServletRequest request) {
		LOGGER.error("Unexpected request failure", exception);
		return response(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", "internal_error", request);
	}

	private static ResponseEntity<ProblemDetail> response(
			HttpStatus status,
			String detail,
			String code,
			HttpServletRequest request
	) {
		return ResponseEntity.status(status).body(problem(status, detail, code, request));
	}

	private static ProblemDetail problem(HttpStatus status, String detail, String code, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(status.getReasonPhrase());
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", code);
		problem.setProperty("timestamp", Instant.now());
		return problem;
	}
}
