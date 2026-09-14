package com.ituseful.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GitHubOwnerOAuth2UserServiceTests {

	@Test
	void grantsOwnerAuthorityForTheConfiguredNumericId() {
		OAuth2User owner = loadUser(42L, Map.of("id", 42, "login", "owner"));

		assertThat(owner.getName()).isEqualTo("42");
		assertThat(owner.getAuthorities())
				.extracting(GrantedAuthority::getAuthority)
				.contains(GitHubOwnerOAuth2UserService.OWNER_AUTHORITY);
		assertThat(owner.<String>getAttribute("login")).isEqualTo("owner");
	}

	@Test
	void acceptsGitHubIdsRepresentedAsNumericStrings() {
		OAuth2User owner = loadUser(42L, Map.of("id", "42", "login", "owner"));

		assertThat(owner.getAuthorities())
				.extracting(GrantedAuthority::getAuthority)
				.contains(GitHubOwnerOAuth2UserService.OWNER_AUTHORITY);
	}

	@Test
	void deniesEveryOtherGitHubAccount() {
		assertThatThrownBy(() -> loadUser(42L, Map.of("id", 43, "login", "other")))
				.isInstanceOf(OAuth2AuthenticationException.class)
				.extracting(exception -> ((OAuth2AuthenticationException) exception).getError().getErrorCode())
				.isEqualTo("owner_required");
	}

	@Test
	void deniesMissingMalformedAndNonPositiveGitHubIds() {
		for (Object id : new Object[] {null, "not-a-number", 42.5, 0, -1}) {
			Map<String, Object> attributes = new LinkedHashMap<>();
			attributes.put("id", id);
			attributes.put("login", "invalid");
			assertThatThrownBy(() -> loadUser(42L, attributes))
					.isInstanceOf(OAuth2AuthenticationException.class)
					.extracting(exception -> ((OAuth2AuthenticationException) exception).getError().getErrorCode())
					.isEqualTo("owner_required");
		}
	}

	private static OAuth2User loadUser(long configuredId, Map<String, Object> attributes) {
		OAuth2User delegateUser = new DefaultOAuth2User(Set.of(), attributes, "login");
		OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = request -> delegateUser;
		return new GitHubOwnerOAuth2UserService(configuredId, delegate).loadUser(null);
	}
}
