package com.devmeter.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginRedirectsTest {

    @Test
    void allowsLocalCallbacksOnAnyPort() {
        assertThat(LoginRedirects.isAllowed("http://127.0.0.1:5555/callback")).isTrue();
        assertThat(LoginRedirects.isAllowed("http://localhost:1234/cb?state=x")).isTrue();
        assertThat(LoginRedirects.isAllowed("http://LOCALHOST:1234/cb")).isTrue();
        assertThat(LoginRedirects.isAllowed("http://[::1]:9000/cb")).isTrue();
    }

    @Test
    void rejectsEverythingElse() {
        String[] rejected = {
                "http://evil.com/cb",
                "https://evil.com/cb",
                "http://127.0.0.1.evil.com/cb",
                "http://localhost.evil.com/cb",
                "http://127.0.0.1@evil.com/cb",
                "http://evil.com@127.0.0.1/cb",   // user info could fool naive parsers
                "https://127.0.0.1:5555/cb",
                "//127.0.0.1:5555/cb",
                "javascript:alert(1)",
                "http://127.0.0.1:5555/cb#fragment",
                "http://127.0.0.1:5555/cb with spaces",
                "",
        };
        for (String uri : rejected) {
            assertThat(LoginRedirects.isAllowed(uri)).as(uri).isFalse();
        }
    }
}
