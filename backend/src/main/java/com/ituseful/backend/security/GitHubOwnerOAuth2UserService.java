package com.ituseful.backend.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.LinkedHashSet;
import java.util.Set;

public final class GitHubOwnerOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

	public static final String OWNER_AUTHORITY = "ROLE_OWNER";
	private static final String OWNER_REQUIRED = "owner_required";

	private final long ownerGithubId;
	private final OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate;

	public GitHubOwnerOAuth2UserService(long ownerGithubId) {
		this(ownerGithubId, new DefaultOAuth2UserService());
	}

	GitHubOwnerOAuth2UserService(
			long ownerGithubId,
			OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate
	) {
		this.ownerGithubId = ownerGithubId;
		this.delegate = delegate;
	}

	@Override
	public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
		OAuth2User user = delegate.loadUser(userRequest);
		long authenticatedGithubId = githubId(user);
		if (authenticatedGithubId != ownerGithubId) {
			throw denied("The authenticated GitHub account is not authorized");
		}

		Set<GrantedAuthority> authorities = new LinkedHashSet<>(user.getAuthorities());
		authorities.add(new SimpleGrantedAuthority(OWNER_AUTHORITY));
		return new DefaultOAuth2User(authorities, user.getAttributes(), "id");
	}

	private static long githubId(OAuth2User user) {
		Object value = user.getAttribute("id");
		try {
			long id = Long.parseLong(String.valueOf(value));
			if (id <= 0) throw new NumberFormatException("GitHub ID must be positive");
			return id;
		} catch (NumberFormatException exception) {
			throw denied("GitHub did not return a valid numeric account ID");
		}
	}

	private static OAuth2AuthenticationException denied(String description) {
		return new OAuth2AuthenticationException(new OAuth2Error(OWNER_REQUIRED), description);
	}
}
