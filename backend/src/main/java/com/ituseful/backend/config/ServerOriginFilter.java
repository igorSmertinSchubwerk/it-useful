package com.ituseful.backend.config;

import com.ituseful.backend.security.SecurityProblemWriter;
import com.ituseful.backend.security.ServerSecurityProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

final class ServerOriginFilter extends OncePerRequestFilter {

	private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

	private final String publicOrigin;
	private final SecurityProblemWriter problemWriter;

	ServerOriginFilter(ServerSecurityProperties properties, SecurityProblemWriter problemWriter) {
		this.publicOrigin = properties.publicOrigin();
		this.problemWriter = problemWriter;
	}

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain
	) throws ServletException, IOException {
		if (isCrossOriginBrowserWrite(request)) {
			problemWriter.write(
					request,
					response,
					HttpStatus.FORBIDDEN,
					"Cross-origin browser writes are not allowed",
					"cross_origin_forbidden"
			);
			return;
		}
		filterChain.doFilter(request, response);
	}

	private boolean isCrossOriginBrowserWrite(HttpServletRequest request) {
		if (SAFE_METHODS.contains(request.getMethod())) return false;
		if ("cross-site".equalsIgnoreCase(request.getHeader("Sec-Fetch-Site"))) return true;
		String origin = request.getHeader("Origin");
		return origin != null && !publicOrigin.equals(origin);
	}
}
