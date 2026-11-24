package com.ituseful.backend.support;

import com.ituseful.backend.domain.Account;
import com.ituseful.backend.domain.AccountRole;
import com.ituseful.backend.domain.AccountStatus;
import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Shared steps for the email delivery tests: an admin and a user, sign-in, and
 * the two link-creating admin calls.
 */
public final class AccountFixtures {

	public static final String PASSWORD = "correct horse battery staple";
	public static final String ADMIN = "admin@example.com";
	public static final String USER = "reader@example.com";

	private AccountFixtures() {
	}

	public static Account confirmed(String email, AccountRole role, String passwordHash) {
		return new Account(email, passwordHash, role, AccountStatus.CONFIRMED);
	}

	public static MockHttpSession signIn(MockMvc mockMvc, String email) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/session/login")
						.param("email", email).param("password", PASSWORD).with(csrf()))
				.andExpect(status().isNoContent())
				.andReturn();
		return (MockHttpSession) result.getRequest().getSession(false);
	}

	public static ResultActions invite(MockMvc mockMvc, MockHttpSession admin, String email) throws Exception {
		return mockMvc.perform(post("/api/admin/invitations").session(admin).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"role\":\"USER\"}".formatted(email)));
	}

	public static ResultActions createReset(MockMvc mockMvc, MockHttpSession admin, Object accountId)
			throws Exception {
		return mockMvc.perform(post("/api/admin/accounts/{id}/password-resets", accountId)
				.session(admin).with(csrf()));
	}

	public static String field(MvcResult result, String path) throws Exception {
		return JsonPath.read(result.getResponse().getContentAsString(), path).toString();
	}
}
