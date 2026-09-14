package com.ituseful.backend.config;

import com.ituseful.backend.security.GitHubOwnerOAuth2UserService;
import com.ituseful.backend.security.SecurityProblemWriter;
import com.ituseful.backend.security.ServerSecurityProperties;
import jakarta.servlet.DispatcherType;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

@Configuration(proxyBeanMethods = false)
@Profile("server")
@EnableConfigurationProperties(ServerSecurityProperties.class)
class ServerSecurityConfiguration {

	@Bean
	ClientRegistrationRepository clientRegistrationRepository(ServerSecurityProperties properties) {
		ClientRegistration github = CommonOAuth2Provider.GITHUB.getBuilder("github")
				.clientId(properties.getGithubClientId())
				.clientSecret(properties.getGithubClientSecret())
				.redirectUri(properties.publicOrigin() + "/login/oauth2/code/{registrationId}")
				.build();
		return new InMemoryClientRegistrationRepository(github);
	}

	@Bean
	GitHubOwnerOAuth2UserService githubOwnerOAuth2UserService(ServerSecurityProperties properties) {
		return new GitHubOwnerOAuth2UserService(properties.getOwnerGithubId());
	}

	@Bean
	SecurityFilterChain serverSecurityFilterChain(
			HttpSecurity http,
			GitHubOwnerOAuth2UserService ownerUserService,
			SecurityProblemWriter problemWriter
	) throws Exception {
		PathPatternRequestMatcher apiMatcher = PathPatternRequestMatcher.withDefaults().matcher("/api/**");
		AccessDeniedHandler accessDeniedHandler = (request, response, exception) -> {
			boolean csrfFailure = exception instanceof MissingCsrfTokenException
					|| exception instanceof InvalidCsrfTokenException;
			problemWriter.write(
					request,
					response,
					HttpStatus.FORBIDDEN,
					csrfFailure ? "A valid CSRF token is required" : "The authenticated account is not authorized",
					csrfFailure ? "csrf_invalid" : "forbidden"
			);
		};

		http
				.authorizeHttpRequests(authorize -> authorize
						.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
						.requestMatchers("/oauth2/authorization/github", "/login", "/login/**").permitAll()
						.requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
						.requestMatchers("/api/**").hasAuthority(GitHubOwnerOAuth2UserService.OWNER_AUTHORITY)
						.anyRequest().denyAll())
				.exceptionHandling(exceptions -> exceptions
						.defaultAuthenticationEntryPointFor((request, response, exception) -> problemWriter.write(
								request,
								response,
								HttpStatus.UNAUTHORIZED,
								"Authentication is required",
								"authentication_required"
						), apiMatcher)
						.accessDeniedHandler(accessDeniedHandler))
				.oauth2Login(oauth -> oauth
						.loginPage("/login")
						.defaultSuccessUrl("/", true)
						.userInfoEndpoint(userInfo -> userInfo.userService(ownerUserService)))
				.sessionManagement(session -> session
						.sessionFixation(fixation -> fixation.migrateSession()))
				.logout(logout -> logout
						.logoutUrl("/logout")
						.invalidateHttpSession(true)
						.clearAuthentication(true)
						.deleteCookies("IT_USEFUL_SESSION")
						.logoutSuccessHandler((request, response, authentication) ->
								response.setStatus(HttpStatus.NO_CONTENT.value())));

		return http.build();
	}
}
