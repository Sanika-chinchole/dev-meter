package com.devmeter.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.zone.ZoneRules;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Maps a client time zone to a name PostgreSQL accepts for {@code AT TIME ZONE}.
 * Java and browsers still use legacy IDs such as "Asia/Calcutta" that our PostgreSQL rejects,
 * so those resolve to a PostgreSQL zone with identical rules (here "Asia/Kolkata").
 */
@Component
@RequiredArgsConstructor
public class TimeZoneResolver {

    private final JdbcTemplate jdbc;

    private final Map<String, String> resolved = new ConcurrentHashMap<>();
    private volatile Set<String> postgresZones;

    /** @throws InvalidRequestException if {@code tz} is not an IANA region ID such as "UTC" or "Asia/Kolkata" */
    public String toPostgresName(String tz) {
        if (tz == null || !ZoneId.getAvailableZoneIds().contains(tz)) {
            throw new InvalidRequestException("tz must be an IANA time zone such as UTC or Asia/Kolkata");
        }
        return resolved.computeIfAbsent(tz, this::lookup);
    }

    private String lookup(String tz) {
        Set<String> pgZones = postgresZones();
        if (pgZones.contains(tz)) {
            return tz;
        }
        ZoneRules rules = ZoneId.of(tz).getRules();
        return pgZones.stream()
                .filter(ZoneId.getAvailableZoneIds()::contains)
                .sorted()
                .filter(name -> ZoneId.of(name).getRules().equals(rules))
                .findFirst()
                .orElseThrow(() -> new InvalidRequestException("tz is not supported by the database"));
    }

    private Set<String> postgresZones() {
        if (postgresZones == null) {
            postgresZones = Set.copyOf(jdbc.queryForList("select name from pg_timezone_names", String.class));
        }
        return postgresZones;
    }
}
