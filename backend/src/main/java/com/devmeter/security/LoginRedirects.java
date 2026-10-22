package com.devmeter.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * State for the browser login handshake. The redirect_uri and the one-time token live in a short session
 * that exists only between /auth/login and the end of the Google round trip; the API itself is stateless.
 */
public final class LoginRedirects {

    public static final String EMAIL_NOT_VERIFIED = "email_not_verified";
    public static final String ACCESS_DENIED = "access_denied";
    public static final String LOGIN_FAILED = "login_failed";

    static final String SUCCESS_PAGE = "/auth/success";
    static final String ERROR_PAGE = "/auth/error";

    private static final String REDIRECT_ATTR = LoginRedirects.class.getName() + ".redirectUri";
    private static final String TOKEN_ATTR = LoginRedirects.class.getName() + ".token";
    private static final Set<String> LOCAL_HOSTS = Set.of("127.0.0.1", "localhost", "[::1]");

    private LoginRedirects() {
    }

    /**
     * Only plain-http local addresses (the extension's callback server, or the dashboard on localhost:5173)
     * may receive a token. Anything else would let a crafted login link send someone's token to another site.
     * TODO(auth): when the dashboard gets a real domain, add that exact https origin here.
     */
    public static boolean isAllowed(String redirectUri) {
        try {
            URI uri = new URI(redirectUri);
            return "http".equals(uri.getScheme())
                    && uri.getHost() != null
                    && LOCAL_HOSTS.contains(uri.getHost().toLowerCase())
                    && uri.getRawUserInfo() == null
                    && uri.getRawFragment() == null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    /** Begins a login; {@code redirectUri} must already be allowed, or null for the manual-copy page. */
    public static void start(HttpServletRequest request, String redirectUri) {
        HttpSession session = request.getSession(true);
        session.removeAttribute(TOKEN_ATTR);
        if (redirectUri == null) {
            session.removeAttribute(REDIRECT_ATTR);
        } else {
            session.setAttribute(REDIRECT_ATTR, redirectUri);
        }
    }

    /** Returns the token once for the success page and ends the login session. */
    public static String takeToken(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        String token = (String) session.getAttribute(TOKEN_ATTR);
        session.invalidate();
        return token;
    }

    static void finishWithToken(HttpServletRequest request, HttpServletResponse response, String token)
            throws IOException {
        String redirectUri = takeRedirect(request);
        if (redirectUri != null) {
            response.sendRedirect(withParam(redirectUri, "token", token));
            return;
        }
        request.getSession(true).setAttribute(TOKEN_ATTR, token);
        response.sendRedirect(SUCCESS_PAGE);
    }

    static void finishWithError(HttpServletRequest request, HttpServletResponse response, String errorCode)
            throws IOException {
        String redirectUri = takeRedirect(request);
        response.sendRedirect(withParam(redirectUri != null ? redirectUri : ERROR_PAGE, "error", errorCode));
    }

    private static String takeRedirect(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        String redirectUri = (String) session.getAttribute(REDIRECT_ATTR);
        session.invalidate();
        return redirectUri;
    }

    private static String withParam(String uri, String name, String value) {
        return uri + (uri.contains("?") ? "&" : "?") + name + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
