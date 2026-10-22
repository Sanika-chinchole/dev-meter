package com.devmeter.web;

import com.devmeter.domain.User;
import com.devmeter.repo.UserRepository;
import com.devmeter.security.JwtService;
import com.devmeter.security.LoginRedirects;
import com.devmeter.security.OAuth2LoginFailureHandler;
import com.devmeter.security.OAuth2LoginSuccessHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthFlowTest {

    static final String CALLBACK = "http://127.0.0.1:5555/callback";

    @Autowired
    MockMvc mvc;

    @Autowired
    OAuth2LoginSuccessHandler loginSuccess;

    @Autowired
    OAuth2LoginFailureHandler loginFailure;

    @Autowired
    JwtService jwt;

    @Autowired
    UserRepository users;

    final String email = "login-" + UUID.randomUUID() + "@example.com";

    @Test
    void loginStartsGoogleFlowAndValidatesRedirectUri() throws Exception {
        mvc.perform(get("/auth/login"))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("/oauth2/authorization/google"));
        mvc.perform(get("/auth/login").param("redirect_uri", CALLBACK))
                .andExpect(status().isFound());
        mvc.perform(get("/auth/login").param("redirect_uri", "https://evil.com/steal"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", startsWith("redirect_uri must be a local address")));

        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", startsWith("https://accounts.google.com/")))
                .andExpect(header().string("Location", containsString("client_id=test-client-id")))
                .andExpect(header().string("Location", containsString("scope=openid%20email%20profile")));
    }

    @Test
    void successRedirectsTokenToCallbackAndUpsertsUser() throws Exception {
        users.save(User.builder().email(email).name("Old Name").build());
        MockHttpServletRequest request = new MockHttpServletRequest();
        LoginRedirects.start(request, CALLBACK);
        MockHttpServletResponse response = new MockHttpServletResponse();

        loginSuccess.onAuthenticationSuccess(request, response, googleLogin(email, true, "Ada Lovelace"));

        assertThat(response.getRedirectedUrl()).startsWith(CALLBACK + "?token=");
        String token = response.getRedirectedUrl().substring((CALLBACK + "?token=").length());
        User user = users.findByEmail(email).orElseThrow();
        assertThat(jwt.decoder().decode(token).getSubject()).isEqualTo(user.getId().toString());
        assertThat(user.getName()).isEqualTo("Ada Lovelace");
        assertThat(((MockHttpSession) request.getSession(false))).isNull(); // login session ended

        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.name").value("Ada Lovelace"));
    }

    @Test
    void successWithoutRedirectShowsTokenOnceForManualCopy() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        LoginRedirects.start(request, null);
        MockHttpServletResponse response = new MockHttpServletResponse();

        loginSuccess.onAuthenticationSuccess(request, response, googleLogin(email, true, "Ada"));

        assertThat(response.getRedirectedUrl()).isEqualTo("/auth/success");
        MockHttpSession session = (MockHttpSession) request.getSession(false);
        String page = mvc.perform(get("/auth/success").session(session))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andReturn().getResponse().getContentAsString();
        String token = page.replaceAll("(?s).*<textarea[^>]*>([^<]+)</textarea>.*", "$1");
        assertThat(jwt.decoder().decode(token).getClaimAsString("email")).isEqualTo(email);

        mvc.perform(get("/auth/success").session(session))
                .andExpect(content().string(containsString("Nothing to show")));
    }

    @Test
    void unverifiedEmailIsRejectedWithoutCreatingUser() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        LoginRedirects.start(request, CALLBACK);
        MockHttpServletResponse response = new MockHttpServletResponse();

        loginSuccess.onAuthenticationSuccess(request, response, googleLogin(email, false, "Ada"));

        assertThat(response.getRedirectedUrl()).isEqualTo(CALLBACK + "?error=email_not_verified");
        assertThat(users.findByEmail(email)).isEmpty();
    }

    @Test
    void cancelledLoginReportsErrorToCallbackOrErrorPage() throws Exception {
        var cancelled = new OAuth2AuthenticationException(new OAuth2Error("access_denied"));

        MockHttpServletRequest withCallback = new MockHttpServletRequest();
        LoginRedirects.start(withCallback, CALLBACK);
        MockHttpServletResponse first = new MockHttpServletResponse();
        loginFailure.onAuthenticationFailure(withCallback, first, cancelled);
        assertThat(first.getRedirectedUrl()).isEqualTo(CALLBACK + "?error=access_denied");

        MockHttpServletResponse second = new MockHttpServletResponse();
        loginFailure.onAuthenticationFailure(new MockHttpServletRequest(), second, cancelled);
        assertThat(second.getRedirectedUrl()).isEqualTo("/auth/error?error=access_denied");

        mvc.perform(get("/auth/error").param("error", "access_denied"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(containsString("Login was cancelled.")));
        mvc.perform(get("/auth/error").param("error", "<script>alert(1)</script>"))
                .andExpect(content().string(containsString("Login failed. Please try again.")))
                .andExpect(content().string(not(containsString("<script>"))));
    }

    @Test
    void apiRequiresValidAppToken() throws Exception {
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
        String forged = new JwtService("a-completely-different-secret-of-32-bytes", 60)
                .issue(User.builder().id(UUID.randomUUID()).email(email).build());
        mvc.perform(get("/usage").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", startsWith("Bearer")));
        mvc.perform(get("/ping")).andExpect(status().isOk());
    }

    private static OAuth2AuthenticationToken googleLogin(String email, boolean verified, String name) {
        var googleUser = new DefaultOAuth2User(List.of(),
                Map.of("sub", "google-" + email, "email", email, "email_verified", verified, "name", name), "sub");
        return new OAuth2AuthenticationToken(googleUser, List.of(), "google");
    }
}
