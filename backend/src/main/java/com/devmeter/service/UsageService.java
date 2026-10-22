package com.devmeter.service;

import com.devmeter.repo.LlmCallRepository;
import com.devmeter.repo.LlmCallRepository.DailyUsage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UsageService {

    static final int DEFAULT_DAYS = 30;
    static final int MAX_DAYS = 366;
    private static final BigDecimal ZERO_COST = BigDecimal.ZERO.setScale(6);

    private final LlmCallRepository calls;
    private final TimeZoneResolver timeZones;

    /**
     * @param from first day, inclusive; defaults to {@value #DEFAULT_DAYS} days ending at {@code to}
     * @param to   last day, inclusive; defaults to today in {@code tz}
     * @param tz   IANA zone deciding where each day starts and ends
     */
    @Transactional(readOnly = true)
    public UsageReport report(UUID userId, LocalDate from, LocalDate to, String tz) {
        String sqlZone = timeZones.toPostgresName(tz);
        ZoneId zone = ZoneId.of(tz);

        LocalDate end = to != null ? to : LocalDate.now(zone);
        LocalDate start = from != null ? from : end.minusDays(DEFAULT_DAYS - 1);
        if (start.isAfter(end)) {
            throw new InvalidRequestException("from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_DAYS) {
            throw new InvalidRequestException("Date range is limited to " + MAX_DAYS + " days");
        }
        Instant rangeStart = start.atStartOfDay(zone).toInstant();
        Instant rangeEnd = end.plusDays(1).atStartOfDay(zone).toInstant();

        Map<LocalDate, DailyUsage> daysWithCalls = calls.usageByDay(userId, rangeStart, rangeEnd, sqlZone).stream()
                .collect(Collectors.toMap(DailyUsage::getDay, Function.identity()));
        List<UsageReport.Day> byDay = start.datesUntil(end.plusDays(1))
                .map(date -> toDay(date, daysWithCalls.get(date)))
                .toList();

        List<UsageReport.Model> byModel = calls.usageByModel(userId, rangeStart, rangeEnd).stream()
                .map(m -> new UsageReport.Model(m.getModel(), m.getCostUsd(), m.getCalls(),
                        m.getInputTokens(), m.getOutputTokens()))
                .toList();

        BigDecimal totalCost = byDay.stream().map(UsageReport.Day::costUsd).reduce(ZERO_COST, BigDecimal::add);
        long totalCalls = byDay.stream().mapToLong(UsageReport.Day::calls).sum();
        return new UsageReport(totalCost, totalCalls, start, end, tz, byDay, byModel);
    }

    private static UsageReport.Day toDay(LocalDate date, DailyUsage usage) {
        if (usage == null) {
            return new UsageReport.Day(date, ZERO_COST, 0, 0, 0);
        }
        return new UsageReport.Day(date, usage.getCostUsd(), usage.getCalls(),
                usage.getInputTokens(), usage.getOutputTokens());
    }
}
