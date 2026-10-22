package com.devmeter.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    JwtDecoder jwtDecoder(JwtService jwt) {
        return jwt.decoder();
    }

    /**
     * Lets the React dashboard read its data from the browser. It sends a Bearer token, never cookies,
     * so credentials stay off. Other endpoints get no CORS headers, so browsers block cross-origin calls to them.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${devmeter.cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins) {
        CorsConfiguration dashboard = new CorsConfiguration();
        dashboard.setAllowedOrigins(allowedOrigins);
        dashboard.setAllowedMethods(List.of("GET"));
        dashboard.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        dashboard.setAllowCredentials(false);
        dashboard.setMaxAge(Duration.ofHours(1));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/usage", dashboard);
        source.registerCorsConfiguration("/auth/me", dashboard);
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder,
                                            OAuth2LoginSuccessHandler loginSuccess,
                                            OAuth2LoginFailureHandler loginFailure) throws Exception {
        // API callers get a 401 problem response, never a redirect to the Google login page.
        AuthenticationEntryPoint unauthorized = (request, response, ex) -> {
            response.setHeader("WWW-Authenticate", "Bearer");
            ProblemResponses.write(response, HttpStatus.UNAUTHORIZED, "Authentication required");
        };

        http
                // Answers CORS preflights (which carry no token) before authorization runs.
                .cors(Customizer.withDefaults())
                // The API authenticates with bearer tokens only, so CSRF doesn't apply; the login
                // handshake is protected by the OAuth2 state parameter.
                .csrf(AbstractHttpConfigurer::disable)
                // No security context in the session. The login handshake still uses a short session
                // for the OAuth2 state and redirect_uri (see LoginRedirects).
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // /auth/me is not listed: it needs a token.
                        .requestMatchers("/ping", "/error", "/auth/login", "/auth/success", "/auth/error",
                                "/oauth2/**", "/login/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2Login(login -> login
                        .loginPage("/auth/login")
                        .successHandler(loginSuccess)
                        .failureHandler(loginFailure))
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.decoder(jwtDecoder))
                        .authenticationEntryPoint(unauthorized))
                .exceptionHandling(errors -> errors.authenticationEntryPoint(unauthorized));
        return http.build();
    }
}
