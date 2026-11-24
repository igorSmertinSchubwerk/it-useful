package com.ituseful.backend.config;

import com.ituseful.backend.repository.AccountRepository;
import com.ituseful.backend.security.AccountAuthorities;
import com.ituseful.backend.security.AccountAuthorityRefreshFilter;
import com.ituseful.backend.security.InvitationTokens;
import com.ituseful.backend.security.PasswordPolicy;
import com.ituseful.backend.security.SecurityProblemWriter;
import com.ituseful.backend.security.ServerSecurityProperties;
import com.ituseful.backend.security.SignInHandler;
import jakarta.servlet.DispatcherType;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationTrustResolver;
import org.springframework.security.authentication.AuthenticationTrustResolverImpl;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

import java.security.SecureRandom;

@Configuration(proxyBeanMethods = false)
@Profile("server")
@EnableConfigurationProperties(ServerSecurityProperties.class)
class ServerSecurityConfiguration {

	@Bean
	PasswordPolicy passwordPolicy() {
		return PasswordPolicy.withBundledCommonPasswords();
	}

	@Bean
	InvitationTokens invitationTokens() {
		return new InvitationTokens(new SecureRandom());
	}

	@Bean
	SecurityFilterChain serverSecurityFilterChain(
			HttpSecurity http,
			ServerSecurityProperties properties,
			SecurityProblemWriter problemWriter,
			SignInHandler signInHandler,
			AccountRepository accountRepository
	) throws Exception {
		PathPatternRequestMatcher apiMatcher = PathPatternRequestMatcher.withDefaults().matcher("/api/**");
		AuthenticationTrustResolver trustResolver = new AuthenticationTrustResolverImpl();
		AccessDeniedHandler accessDeniedHandler = (request, response, exception) -> {
			Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
			boolean unauthenticated = authentication == null || trustResolver.isAnonymous(authentication);
			boolean csrfFailure = exception instanceof MissingCsrfTokenException
					|| exception instanceof InvalidCsrfTokenException;
			HttpStatus status = unauthenticated ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
			boolean pending = !unauthenticated && !csrfFailure && authentication.getAuthorities().stream()
					.anyMatch(authority -> AccountAuthorities.PENDING.equals(authority.getAuthority()));
			if (pending) {
				problemWriter.write(request, response, status,
						"An admin has not confirmed this account yet", "confirmation_pending");
				return;
			}
			problemWriter.write(
					request,
					response,
					status,
					unauthenticated
							? "Authentication is required"
							: csrfFailure
									? "A valid CSRF token is required"
									: "The signed-in account is not authorized",
					unauthenticated ? "authentication_required" : csrfFailure ? "csrf_invalid" : "forbidden"
			);
		};

		http
				.authorizeHttpRequests(authorize -> authorize
						.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
						.requestMatchers(HttpMethod.GET, "/api/session/csrf").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/session/login").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/invitations/accept").permitAll()
						.requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/session").authenticated()
						.requestMatchers("/api/admin/**").hasRole("ADMIN")
						.requestMatchers(HttpMethod.GET, "/api/**").hasAnyRole("USER", "ADMIN")
						.requestMatchers("/api/**").hasRole("ADMIN")
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
				.formLogin(form -> form
						.loginPage("/sign-in")
						.loginProcessingUrl("/api/session/login")
						.usernameParameter("email")
						.passwordParameter("password")
						.successHandler(signInHandler)
						.failureHandler(signInHandler))
				.sessionManagement(session -> session
						.sessionFixation(fixation -> fixation.migrateSession()))
				.addFilterAfter(new ServerOriginFilter(properties, problemWriter), CsrfFilter.class)
				.addFilterBefore(new AccountAuthorityRefreshFilter(accountRepository), AuthorizationFilter.class)
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
