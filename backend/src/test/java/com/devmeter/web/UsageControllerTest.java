package com.devmeter.web;

import com.devmeter.domain.LlmCall;
import com.devmeter.domain.Provider;
import com.devmeter.domain.User;
import com.devmeter.repo.LlmCallRepository;
import com.devmeter.security.JwtService;
import com.devmeter.service.UserService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UsageControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    UserService users;

    @Autowired
    LlmCallRepository calls;

    @Autowired
    EntityManager em;

    @Autowired
    JwtService jwt;

    final String email = "usage-" + UUID.randomUUID() + "@example.com";
    String token;

    @BeforeEach
    void seed() {
        User user = users.findOrCreateByEmail(email);
        token = jwt.issue(user);
        UUID userId = user.getId();
        UUID otherUserId = users.findOrCreateByEmail("other-" + email).getId();

        save(userId, "claude-sonnet", "0.010000", "2026-10-01T10:00:00Z");
        save(userId, "gpt-4o", "5.000000", "2026-10-01T20:00:00Z");      // Oct 2 in India
        save(userId, "claude-sonnet", "0.020000", "2026-10-03T10:00:00Z");
        save(userId, "gpt-4o-mini", "0.001500", "2026-10-03T12:00:00Z");
        save(userId, "claude-sonnet", "7.000000", "2026-10-04T00:00:00Z"); // first instant after the range
        save(otherUserId, "claude-sonnet", "9.000000", "2026-10-02T10:00:00Z");
        em.clear();
    }

    @Test
    void totalsByDayZeroFilledAndByModel() throws Exception {
        usage("?from=2026-10-01&to=2026-10-03")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCostUsd").value(5.0315))
                .andExpect(jsonPath("$.totalCalls").value(4))
                .andExpect(jsonPath("$.from").value("2026-10-01"))
                .andExpect(jsonPath("$.to").value("2026-10-03"))
                .andExpect(jsonPath("$.tz").value("UTC"))
                .andExpect(jsonPath("$.byDay", hasSize(3)))
                .andExpect(jsonPath("$.byDay[0].date").value("2026-10-01"))
                .andExpect(jsonPath("$.byDay[0].costUsd").value(5.01))
                .andExpect(jsonPath("$.byDay[0].calls").value(2))
                .andExpect(jsonPath("$.byDay[1].date").value("2026-10-02"))
                .andExpect(jsonPath("$.byDay[1].costUsd").value(0.0))
                .andExpect(jsonPath("$.byDay[1].calls").value(0))
                .andExpect(jsonPath("$.byDay[2].costUsd").value(0.0215))
                .andExpect(jsonPath("$.byDay[2].inputTokens").value(200))
                .andExpect(jsonPath("$.byModel", hasSize(3)))
                .andExpect(jsonPath("$.byModel[0].model").value("gpt-4o"))
                .andExpect(jsonPath("$.byModel[1].model").value("claude-sonnet"))
                .andExpect(jsonPath("$.byModel[1].costUsd").value(0.03))
                .andExpect(jsonPath("$.byModel[1].calls").value(2))
                .andExpect(jsonPath("$.byModel[1].outputTokens").value(100));
    }

    @Test
    void timeZoneDecidesDayBoundariesAndAcceptsLegacyIds() throws Exception {
        // Asia/Calcutta is the legacy ID browsers still send; PostgreSQL only knows Asia/Kolkata.
        usage("?from=2026-10-01&to=2026-10-03&tz=Asia/Calcutta")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tz").value("Asia/Calcutta"))
                .andExpect(jsonPath("$.totalCalls").value(4))
                .andExpect(jsonPath("$.byDay[0].calls").value(1))
                .andExpect(jsonPath("$.byDay[1].costUsd").value(5.0))
                .andExpect(jsonPath("$.byDay[1].calls").value(1));
    }

    @Test
    void defaultsToLast30DaysEndingTodayInUtc() throws Exception {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        usage("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.to").value(today.toString()))
                .andExpect(jsonPath("$.from").value(today.minusDays(29).toString()))
                .andExpect(jsonPath("$.byDay", hasSize(30)));
    }

    @Test
    void rejectsBadRanges() throws Exception {
        usage("?from=2026-10-03&to=2026-10-01").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("from must be on or before to"));
        usage("?from=2025-01-01&to=2026-10-01").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Date range is limited to 366 days"));
        usage("?from=2025-10-01&to=2026-10-01").andExpect(status().isOk()); // exactly 366 days
        usage("?from=yesterday").andExpect(status().isBadRequest());
        usage("?tz=Mars/Olympus").andExpect(status().isBadRequest());
        usage("?tz=%2B05:30").andExpect(status().isBadRequest());
    }

    @Test
    void requiresAuth() throws Exception {
        mvc.perform(get("/usage")).andExpect(status().isUnauthorized());
    }

    private ResultActions usage(String query) throws Exception {
        return mvc.perform(get("/usage" + query).header("Authorization", "Bearer " + token));
    }

    private void save(UUID userId, String model, String cost, String createdAt) {
        LlmCall call = calls.saveAndFlush(LlmCall.builder()
                .userId(userId)
                .model(model)
                .provider(Provider.OTHER)
                .inputTokens(100)
                .outputTokens(50)
                .costUsd(new BigDecimal(cost))
                .build());
        em.createNativeQuery("update llm_calls set created_at = :ts where id = :id")
                .setParameter("ts", Instant.parse(createdAt))
                .setParameter("id", call.getId())
                .executeUpdate();
    }
}
