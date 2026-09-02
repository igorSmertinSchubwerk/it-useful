package com.ituseful.backend.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = CompleteTranslationsValidator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface CompleteTranslations {

	String message() default "must contain exactly one EN, DE, and RU translation";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};
}
