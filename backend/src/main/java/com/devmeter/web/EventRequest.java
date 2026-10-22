package com.devmeter.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /events}: usage metadata only, never prompt or response text.
 * Unknown fields are rejected globally (spring.jackson.deserialization.fail-on-unknown-properties),
 * and every field is a scalar, so nested objects or arrays cannot be smuggled in.
 */
public record EventRequest(
        @NotBlank @Size(max = 200) String model,
        @NotBlank @Size(max = 50) String provider,
        @NotNull @PositiveOrZero @Max(MAX_TOKENS) Integer inputTokens,
        @NotNull @PositiveOrZero @Max(MAX_TOKENS) Integer outputTokens,
        @PositiveOrZero @Max(MAX_LATENCY_MS) Integer latencyMs,
        @Size(max = 100) String projectTag) {

    static final long MAX_TOKENS = 100_000_000;
    static final long MAX_LATENCY_MS = 100_000_000;
}
