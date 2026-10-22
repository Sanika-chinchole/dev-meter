package com.devmeter.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProviderTest {

    @Test
    void fromValueIsCaseInsensitive() {
        assertThat(Provider.fromValue("anthropic")).isEqualTo(Provider.ANTHROPIC);
        assertThat(Provider.fromValue(" Anthropic ")).isEqualTo(Provider.ANTHROPIC);
        assertThat(Provider.fromValue("OPENAI")).isEqualTo(Provider.OPENAI);
        assertThat(Provider.fromValue("gemini")).isEqualTo(Provider.GOOGLE);
        assertThat(Provider.fromValue(" Gemini ")).isEqualTo(Provider.GOOGLE);
    }

    @Test
    void unknownOrMissingProviderFallsBackToOther() {
        assertThat(Provider.fromValue("some-new-lab")).isEqualTo(Provider.OTHER);
        assertThat(Provider.fromValue("")).isEqualTo(Provider.OTHER);
        assertThat(Provider.fromValue(null)).isEqualTo(Provider.OTHER);
    }
}
