package com.devmeter.security;

import com.devmeter.domain.User;
import com.devmeter.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** After Google login: upsert the user, mint an app JWT, and hand it to the extension's callback or the success page. */
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final UserService users;
    private final JwtService jwt;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User google = (OAuth2User) authentication.getPrincipal();
        String email = google.getAttribute("email");
        // Users are matched by email, so an unverified address could claim someone else's account.
        if (email == null || !isTrue(google.getAttribute("email_verified"))) {
            LoginRedirects.finishWithError(request, response, LoginRedirects.EMAIL_NOT_VERIFIED);
            return;
        }
        // Any Google account may sign in. Future knob: restrict to company domains via the "hd" claim.
        User user = users.upsertFromLogin(email, google.getAttribute("name"));
        LoginRedirects.finishWithToken(request, response, jwt.issue(user));
    }

    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equals(value);
    }
}
