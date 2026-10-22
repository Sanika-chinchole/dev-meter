package com.devmeter.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Dashboard data for one user over an inclusive date range. Costs are USD with 6 decimal places. */
public record UsageReport(
        BigDecimal totalCostUsd,
        long totalCalls,
        LocalDate from,
        LocalDate to,
        String tz,
        List<Day> byDay,
        List<Model> byModel) {

    /** One entry per calendar day in the range, including days with no calls. */
    public record Day(LocalDate date, BigDecimal costUsd, long calls, long inputTokens, long outputTokens) {
    }

    /** Sorted by cost, highest first. */
    public record Model(String model, BigDecimal costUsd, long calls, long inputTokens, long outputTokens) {
    }
}
