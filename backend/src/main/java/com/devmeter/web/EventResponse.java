package com.devmeter.web;

import java.math.BigDecimal;
import java.util.UUID;

/** {@code priced} is false when the model has no price yet, so {@code costUsd} is 0. */
public record EventResponse(UUID id, BigDecimal costUsd, boolean priced) {
}
