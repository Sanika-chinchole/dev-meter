package com.devmeter.security;

import java.util.UUID;

/** The authenticated user; inject into controllers with {@code @AuthenticationPrincipal}. */
public record CurrentUser(UUID id, String email) {
}
