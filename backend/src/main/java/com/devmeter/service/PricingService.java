package com.devmeter.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class PricingService {

    // ---------------------------------------------------------------------------------------------
    // PRICE TABLE: the only place rates live. USD per million tokens (input, output).
    // Keys are lowercase model names; suffixed variants ("claude-sonnet-5", "gpt-4o-2024-08-06")
    // resolve to the longest matching key.
    // Verified 2026-10-22 against https://platform.claude.com/docs/en/about-claude/pricing:
    //   claude-sonnet-5-5, claude-opus-5-5 (base rates; no caching or batch discounts applied).
    // Verified 2026-10-22 against https://ai.google.dev/gemini-api/docs/pricing (paid tier, text input;
    //   output includes thinking tokens). The free tier bills $0; DevMeter records list price regardless.
    //   TODO verify rates: gemini-3.8-flash rises to $1.50 / $7.50 on 2027-01-01. gemini-2.5-pro costs
    //   $2.50 / $15.00 for prompts over 200k tokens (Ask AI prompts are far smaller).
    // TODO verify rates: the generic entries below are placeholders based on older public list prices.
    // ---------------------------------------------------------------------------------------------
    private static final Map<String, ModelPrice> PRICES = Map.of(
            "claude-sonnet-5-5", ModelPrice.of("2.00", "10.00"), // anthropic, verified
            "claude-opus-5-5", ModelPrice.of("4.00", "20.00"),   // anthropic, verified
            "gemini-3.8-flash", ModelPrice.of("0.75", "3.75"),   // google, verified (through 2026-12-31)
            "gemini-3.5-flash-lite", ModelPrice.of("0.30", "2.50"), // google, verified
            "gemini-2.5-flash", ModelPrice.of("0.30", "2.50"),   // google, verified
            "gemini-2.5-pro", ModelPrice.of("1.25", "10.00"),    // google, verified (prompts <= 200k)
            "claude-sonnet", ModelPrice.of("3.00", "15.00"),     // anthropic, placeholder
            "claude-haiku", ModelPrice.of("1.00", "5.00"),       // anthropic, placeholder
            "gpt-4o", ModelPrice.of("2.50", "10.00"),            // openai, placeholder
            "gpt-4o-mini", ModelPrice.of("0.15", "0.60")         // openai, placeholder
    );

    private static final BigDecimal ONE_MILLION = BigDecimal.valueOf(1_000_000);
    private static final int COST_SCALE = 6; // matches llm_calls.cost_usd NUMERIC(10,6)
    private static final BigDecimal ZERO_COST = BigDecimal.ZERO.setScale(COST_SCALE);

    // Bounds memory if clients send many distinct junk model names; past this we stop warning.
    private static final int MAX_WARNED_MODELS = 1_000;

    /** Longest keys first, so "gpt-4o-mini-..." matches gpt-4o-mini rather than gpt-4o. */
    private final List<String> keysLongestFirst = PRICES.keySet().stream()
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();

    private final Set<String> warnedModels = ConcurrentHashMap.newKeySet();

    /**
     * Cost in USD, rounded to 6 decimal places (HALF_UP).
     * Unknown models cost 0 and log a warning once per model name; see {@link #isKnownModel}.
     *
     * @throws IllegalArgumentException if a token count is negative
     */
    public BigDecimal computeCost(String model, int inputTokens, int outputTokens) {
        if (inputTokens < 0 || outputTokens < 0) {
            throw new IllegalArgumentException(
                    "Token counts must be >= 0, got input=" + inputTokens + ", output=" + outputTokens);
        }
        Optional<ModelPrice> price = findPrice(model);
        if (price.isEmpty()) {
            warnUnknownModel(model);
            return ZERO_COST;
        }
        BigDecimal perMillion = price.get().inPerMTok().multiply(BigDecimal.valueOf(inputTokens))
                .add(price.get().outPerMTok().multiply(BigDecimal.valueOf(outputTokens)));
        return perMillion.divide(ONE_MILLION, COST_SCALE, RoundingMode.HALF_UP);
    }

    /** False when {@link #computeCost} would return 0 only because the model has no price. */
    public boolean isKnownModel(String model) {
        return findPrice(model).isPresent();
    }

    private Optional<ModelPrice> findPrice(String model) {
        if (model == null || model.isBlank()) {
            return Optional.empty();
        }
        String normalized = model.trim().toLowerCase(Locale.ROOT);
        ModelPrice exact = PRICES.get(normalized);
        if (exact != null) {
            return Optional.of(exact);
        }
        return keysLongestFirst.stream()
                .filter(key -> isPrefixAtBoundary(key, normalized))
                .findFirst()
                .map(PRICES::get);
    }

    /** "gpt-4o" matches "gpt-4o-2024-08-06" but not "gpt-4omega". */
    private static boolean isPrefixAtBoundary(String key, String model) {
        return model.startsWith(key) && !Character.isLetterOrDigit(model.charAt(key.length()));
    }

    private void warnUnknownModel(String model) {
        String name = String.valueOf(model);
        if (warnedModels.size() < MAX_WARNED_MODELS && warnedModels.add(name)) {
            log.warn("No price for model '{}'; recording cost 0. Add it to PricingService.PRICES.", name);
        }
    }
}
