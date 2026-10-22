package com.devmeter.domain;

import java.util.Arrays;
import java.util.Locale;

/**
 * LLM provider, stored in the TEXT column as its lowercase {@link #value()}.
 * Unknown names map to {@link #OTHER} so ingest never rejects a call over a new provider.
 */
public enum Provider {
    OPENAI("openai"),
    ANTHROPIC("anthropic"),
    GOOGLE("google"),
    MISTRAL("mistral"),
    COHERE("cohere"),
    OTHER("other");

    private final String value;

    Provider(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    /** Case-insensitive lookup; null, blank or unknown names return {@link #OTHER}. */
    public static Provider fromValue(String raw) {
        if (raw == null) {
            return OTHER;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        if (normalized.equals("gemini")) {
            return GOOGLE; // the extension names the provider by product ("gemini"); store the company
        }
        return Arrays.stream(values())
                .filter(p -> p.value.equals(normalized))
                .findFirst()
                .orElse(OTHER);
    }
}
