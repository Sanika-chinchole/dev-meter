package com.devmeter.security;

import com.devmeter.domain.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Issues and validates the app's own HS256 JWTs (sub = userId, email claim).
 * <p>
 * TODO(auth): tokens are valid for devmeter.jwt.ttl-minutes (30 days) and cannot be revoked.
 * Before onboarding teams, add refresh tokens and revocation, then shorten the TTL.
 */
@Service
public class JwtService {

    static final String ISSUER = "devmeter";
    static final String EMAIL_CLAIM = "email";
    private static final int MIN_SECRET_BYTES = 32; // HS256 needs a key of at least 256 bits

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final Duration ttl;

    public JwtService(@Value("${devmeter.jwt.secret:}") String secret,
                      @Value("${devmeter.jwt.ttl-minutes:43200}") long ttlMinutes) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET (devmeter.jwt.secret) must be set and at least "
                    + MIN_SECRET_BYTES + " bytes long. Generate one with: openssl rand -base64 48");
        }
        if (ttlMinutes <= 0) {
            throw new IllegalStateException("devmeter.jwt.ttl-minutes must be positive, got " + ttlMinutes);
        }
        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));

        NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        nimbusDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(ISSUER), JwtService::hasUserClaims));
        this.decoder = nimbusDecoder;
        this.ttl = Duration.ofMinutes(ttlMinutes);
    }

    public String issue(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .claim(EMAIL_CLAIM, user.getEmail())
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /** Validates signature, issuer, expiry, and that sub is a user id. */
    public JwtDecoder decoder() {
        return decoder;
    }

    static CurrentUser toCurrentUser(Jwt jwt) {
        return new CurrentUser(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString(EMAIL_CLAIM));
    }

    private static OAuth2TokenValidatorResult hasUserClaims(Jwt jwt) {
        try {
            UUID.fromString(jwt.getSubject());
        } catch (RuntimeException e) {
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "sub must be a user id", null));
        }
        return jwt.hasClaim(EMAIL_CLAIM)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "email claim missing", null));
    }
}
