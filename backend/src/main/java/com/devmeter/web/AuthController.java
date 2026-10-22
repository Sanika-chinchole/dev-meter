package com.devmeter.web;

import com.devmeter.domain.User;
import com.devmeter.repo.UserRepository;
import com.devmeter.security.CurrentUser;
import com.devmeter.security.LoginRedirects;
import com.devmeter.service.InvalidRequestException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private static final Map<String, String> ERROR_MESSAGES = Map.of(
            LoginRedirects.ACCESS_DENIED, "Login was cancelled.",
            LoginRedirects.EMAIL_NOT_VERIFIED, "Your Google account email is not verified.",
            LoginRedirects.LOGIN_FAILED, "Login failed. Please try again.");

    private final UserRepository users;

    /**
     * Starts Google login. The extension passes its local callback as redirect_uri and receives
     * {@code ?token=<jwt>} (or {@code ?error=<code>}); without one, the token is shown on /auth/success.
     */
    @GetMapping("/auth/login")
    public void login(@RequestParam(name = "redirect_uri", required = false) String redirectUri,
                      HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (redirectUri != null && !LoginRedirects.isAllowed(redirectUri)) {
            throw new InvalidRequestException("redirect_uri must be a local address such as http://127.0.0.1:<port>/callback");
        }
        LoginRedirects.start(request, redirectUri);
        response.sendRedirect("/oauth2/authorization/google");
    }

    /** Shows the token once, right after a login that had no redirect_uri, for manual copying. */
    @GetMapping("/auth/success")
    public ResponseEntity<String> success(HttpServletRequest request) {
        String token = LoginRedirects.takeToken(request);
        String body = token == null
                ? page("Nothing to show", "<p>The token is shown only once, right after login. "
                        + "<a href=\"/auth/login\">Log in again</a>.</p>")
                : page("Logged in to DevMeter", "<p>Copy this token into the DevMeter extension. "
                        + "It is valid for 30 days and won't be shown again.</p>"
                        + "<textarea readonly rows=\"6\" cols=\"80\" onclick=\"this.select()\">" + token + "</textarea>");
        return html(HttpStatus.OK, body);
    }

    @GetMapping("/auth/error")
    public ResponseEntity<String> error(@RequestParam(name = "error", required = false) String error) {
        // Only our own fixed messages are rendered, never the raw parameter.
        String message = ERROR_MESSAGES.getOrDefault(error, ERROR_MESSAGES.get(LoginRedirects.LOGIN_FAILED));
        return html(HttpStatus.UNAUTHORIZED, page("Login failed", "<p>" + message
                + " <a href=\"/auth/login\">Try again</a>.</p>"));
    }

    @GetMapping("/auth/me")
    public MeResponse me(CurrentUser currentUser) {
        User user = users.findById(currentUser.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User no longer exists"));
        return new MeResponse(user.getId(), user.getEmail(), user.getName());
    }

    public record MeResponse(UUID id, String email, String name) {
    }

    private static ResponseEntity<String> html(HttpStatus status, String body) {
        return ResponseEntity.status(status)
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.TEXT_HTML)
                .body(body);
    }

    private static String page(String title, String content) {
        return """
                <!doctype html>
                <html lang="en"><head><meta charset="utf-8"><title>%s</title>
                <style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem}
                textarea{width:100%%;font-family:monospace}</style></head>
                <body><h1>%s</h1>%s</body></html>
                """.formatted(title, title, content);
    }
}
