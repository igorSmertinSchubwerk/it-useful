package com.ituseful.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.rememberme.InvalidCookieException;
import org.springframework.security.web.authentication.rememberme.PersistentRememberMeToken;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.security.web.authentication.rememberme.RememberMeAuthenticationException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Date;

/**
 * Spring's persistent remember-me login with two changes:
 * <ul>
 *   <li>The database holds only a SHA-256 hash of each token, like invitation and
 *       reset links, so a dump cannot be turned into a working cookie.</li>
 *   <li>A token never rotates and expires 30 days after sign-in. Spring rotates on
 *       every use, so parallel requests after a session timeout look like a stolen
 *       cookie and end the login on every device.</li>
 * </ul>
 */
public class HashedRememberMeServices extends PersistentTokenBasedRememberMeServices {

	private final PersistentTokenRepository tokens;
	private final Duration validity;
	private final Clock clock;

	public HashedRememberMeServices(
			String key,
			UserDetailsService users,
			PersistentTokenRepository tokens,
			Duration validity,
			Clock clock
	) {
		super(key, users, new HashingTokens(tokens));
		this.tokens = tokens;
		this.validity = validity;
		this.clock = clock;
		setTokenValiditySeconds((int) validity.toSeconds());
		// A sign-in lockout stops password guessing. It ends no live session, so it
		// ends no 30-day login either. A disabled account is still refused.
		setUserDetailsChecker(user -> {
			if (!user.isEnabled()) {
				throw new DisabledException("The account is disabled");
			}
		});
	}

	@Override
	protected UserDetails processAutoLoginCookie(
			String[] cookieTokens,
			HttpServletRequest request,
			HttpServletResponse response
	) {
		if (cookieTokens.length != 2) {
			throw new InvalidCookieException("The remember-me cookie must hold a series and a token");
		}
		PersistentRememberMeToken stored = tokens.getTokenForSeries(cookieTokens[0]);
		if (stored == null || !sameHash(stored.getTokenValue(), InvitationTokens.hash(cookieTokens[1]))) {
			throw new RememberMeAuthenticationException("The remember-me cookie is unknown");
		}
		if (stored.getDate().toInstant().plus(validity).isBefore(clock.instant())) {
			throw new RememberMeAuthenticationException("The remember-me login has expired");
		}
		return getUserDetailsService().loadUserByUsername(stored.getUsername());
	}

	private static boolean sameHash(String stored, String presented) {
		return MessageDigest.isEqual(
				stored.getBytes(StandardCharsets.US_ASCII), presented.getBytes(StandardCharsets.US_ASCII));
	}

	private record HashingTokens(PersistentTokenRepository delegate) implements PersistentTokenRepository {

		@Override
		public void createNewToken(PersistentRememberMeToken token) {
			delegate.createNewToken(new PersistentRememberMeToken(
					token.getUsername(), token.getSeries(), InvitationTokens.hash(token.getTokenValue()), token.getDate()));
		}

		@Override
		public void updateToken(String series, String tokenValue, Date lastUsed) {
			delegate.updateToken(series, InvitationTokens.hash(tokenValue), lastUsed);
		}

		@Override
		public PersistentRememberMeToken getTokenForSeries(String seriesId) {
			return delegate.getTokenForSeries(seriesId);
		}

		@Override
		public void removeUserTokens(String username) {
			delegate.removeUserTokens(username);
		}
	}
}
