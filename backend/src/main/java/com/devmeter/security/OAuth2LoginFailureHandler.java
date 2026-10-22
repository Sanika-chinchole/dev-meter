package com.devmeter.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Cancelled or failed Google login: report an error code to the callback, or show the error page. */
@Slf4j
@Component
public class OAuth2LoginFailureHandler implements AuthenticationFailureHandler {

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        boolean cancelled = exception instanceof OAuth2AuthenticationException oauth
                && LoginRedirects.ACCESS_DENIED.equals(oauth.getError().getErrorCode());
        if (!cancelled) {
            log.warn("Google login failed: {}", exception.getMessage());
        }
        LoginRedirects.finishWithError(request, response,
                cancelled ? LoginRedirects.ACCESS_DENIED : LoginRedirects.LOGIN_FAILED);
    }
}
