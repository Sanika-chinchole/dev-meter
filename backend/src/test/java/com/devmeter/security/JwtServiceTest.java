package com.devmeter.security;

import com.devmeter.domain.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    static final String SECRET = "unit-test-secret-that-is-at-least-32-bytes";

    final JwtService jwt = new JwtService(SECRET, 43200);
    final User user = User.builder().id(UUID.randomUUID()).email("ada@example.com").build();

    @Test
    void issuedTokenDecodesWithUserClaims() {
        Jwt decoded = jwt.decoder().decode(jwt.issue(user));

        assertThat(decoded.getSubject()).isEqualTo(user.getId().toString());
        assertThat(decoded.getClaimAsString("email")).isEqualTo("ada@example.com");
        assertThat(decoded.getClaimAsString("iss")).isEqualTo("devmeter");
        assertThat(decoded.getHeaders()).containsEntry("alg", "HS256");
        assertThat(Duration.between(decoded.getIssuedAt(), decoded.getExpiresAt())).isEqualTo(Duration.ofDays(30));
        assertThat(JwtService.toCurrentUser(decoded)).isEqualTo(new CurrentUser(user.getId(), "ada@example.com"));
    }

    @Test
    void rejectsTokenSignedWithAnotherSecret() {
        String forged = new JwtService("a-completely-different-secret-of-32-bytes", 60).issue(user);
        assertThatThrownBy(() -> jwt.decoder().decode(forged)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsExpiredToken() {
        Instant twoHoursAgo = Instant.now().minus(Duration.ofHours(2));
        String expired = sign("devmeter", user.getId().toString(), twoHoursAgo, twoHoursAgo.plus(Duration.ofHours(1)));
        assertThatThrownBy(() -> jwt.decoder().decode(expired)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsWrongIssuerOrNonUserSubject() {
        Instant now = Instant.now();
        Instant later = now.plusSeconds(600);
        assertThatThrownBy(() -> jwt.decoder().decode(sign("someone-else", user.getId().toString(), now, later)))
                .isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> jwt.decoder().decode(sign("devmeter", "not-a-uuid", now, later)))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void refusesToStartWithBadConfig() {
        assertThatThrownBy(() -> new JwtService("", 60)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
        assertThatThrownBy(() -> new JwtService("too-short", 60)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService(SECRET, 0)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ttl-minutes");
    }

    /** Signs with the real secret but arbitrary claims, to test claim validation alone. */
    private static String sign(String issuer, String subject, Instant issuedAt, Instant expiresAt) {
        var key = new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer(issuer).subject(subject).claim("email", "x@example.com")
                .issuedAt(issuedAt).expiresAt(expiresAt).build();
        return new NimbusJwtEncoder(new ImmutableSecret<>(key))
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(), claims))
                .getTokenValue();
    }
}
