package com.devmeter.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(OutputCaptureExtension.class)
class PricingServiceTest {

    final PricingService pricing = new PricingService();

    @Test
    void knownModel() {
        // 1000 * $3/M + 500 * $15/M = 0.003 + 0.0075
        assertThat(pricing.computeCost("claude-sonnet", 1000, 500)).isEqualTo(new BigDecimal("0.010500"));
        assertThat(pricing.computeCost("gpt-4o-mini", 1_000_000, 1_000_000)).isEqualTo(new BigDecimal("0.750000"));
        assertThat(pricing.isKnownModel("gpt-4o")).isTrue();
    }

    @Test
    void normalizesAndMatchesLongestPrefix() {
        BigDecimal sonnet = pricing.computeCost("claude-sonnet", 1000, 500);
        assertThat(pricing.computeCost("claude-sonnet-5", 1000, 500)).isEqualTo(sonnet);
        assertThat(pricing.computeCost("  Claude-Sonnet-5 ", 1000, 500)).isEqualTo(sonnet);

        // Must resolve to gpt-4o-mini ($0.15/M), not the shorter gpt-4o ($2.50/M).
        assertThat(pricing.computeCost("gpt-4o-mini-2024-07-18", 1_000_000, 0)).isEqualTo(new BigDecimal("0.150000"));
        assertThat(pricing.computeCost("gpt-4o-2024-08-06", 1_000_000, 0)).isEqualTo(new BigDecimal("2.500000"));
    }

    @Test
    void prefixOnlyMatchesAtWordBoundary() {
        assertThat(pricing.isKnownModel("gpt-4omega")).isFalse();
    }

    @Test
    void unknownModelCostsZeroAndWarnsOnce(CapturedOutput output) {
        assertThat(pricing.computeCost("mystery-9000", 1000, 1000)).isEqualTo(new BigDecimal("0.000000"));
        assertThat(pricing.computeCost("mystery-9000", 5, 5)).isEqualTo(new BigDecimal("0.000000"));
        assertThat(pricing.computeCost(null, 10, 10)).isEqualTo(new BigDecimal("0.000000"));
        assertThat(pricing.isKnownModel("mystery-9000")).isFalse();
        assertThat(pricing.isKnownModel(null)).isFalse();

        assertThat(output.getOut().split("No price for model 'mystery-9000'", -1)).hasSize(2);
    }

    @Test
    void roundsToSixDecimalsHalfUp() {
        // gpt-4o-mini input is $0.15/M: 3 tokens = 0.00000045 -> 0.000000, 4 tokens = 0.0000006 -> 0.000001
        assertThat(pricing.computeCost("gpt-4o-mini", 3, 0)).isEqualTo(new BigDecimal("0.000000"));
        assertThat(pricing.computeCost("gpt-4o-mini", 4, 0)).isEqualTo(new BigDecimal("0.000001"));
        assertThat(pricing.computeCost("claude-sonnet", 0, 0)).isEqualTo(new BigDecimal("0.000000"));
    }

    @Test
    void negativeTokensThrow() {
        assertThatThrownBy(() -> pricing.computeCost("claude-sonnet", -1, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> pricing.computeCost("unknown-model", 0, -1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
