package com.ituseful.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI itUsefulOpenApi() {
		return new OpenAPI().info(new Info()
				.title("IT Useful API")
				.version("0.1.0")
				.description("REST API for multilingual IT definitions and their images."));
	}
}
