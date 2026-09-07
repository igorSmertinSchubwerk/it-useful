package com.ituseful.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Set;

@Component
public class ApiSecurityFilter extends OncePerRequestFilter {

	private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain
	) throws ServletException, IOException {
		addSecurityHeaders(response);
		if (isCrossOriginWrite(request)) {
			response.setStatus(HttpServletResponse.SC_FORBIDDEN);
			response.setContentType("application/problem+json");
			response.getWriter().write("""
					{"title":"Forbidden","status":403,"detail":"Cross-origin write blocked","code":"cross_origin_forbidden"}
					""");
			return;
		}
		filterChain.doFilter(request, response);
	}

	private static boolean isCrossOriginWrite(HttpServletRequest request) {
		if (SAFE_METHODS.contains(request.getMethod())) {
			return false;
		}
		if ("cross-site".equalsIgnoreCase(request.getHeader("Sec-Fetch-Site"))) {
			return true;
		}
		String origin = request.getHeader("Origin");
		if (origin == null) {
			return false; // Non-browser clients do not send Origin and remain supported locally.
		}
		try {
			URI uri = new URI(origin);
			String host = uri.getHost();
			return uri.getUserInfo() != null
					|| (uri.getPath() != null && !uri.getPath().isEmpty())
					|| uri.getQuery() != null
					|| uri.getFragment() != null
					|| !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
					|| !("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host)
					|| "::1".equals(host) || "[::1]".equals(host));
		} catch (URISyntaxException exception) {
			return true;
		}
	}

	private static void addSecurityHeaders(HttpServletResponse response) {
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
		response.setHeader("X-Frame-Options", "DENY");
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
		response.setHeader("X-XSS-Protection", "0");
	}
}
