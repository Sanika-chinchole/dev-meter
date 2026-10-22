package com.devmeter.repo;

import com.devmeter.domain.LlmCall;
import com.devmeter.domain.Provider;
import com.devmeter.domain.User;
import com.devmeter.repo.LlmCallRepository.DailyUsage;
import com.devmeter.repo.LlmCallRepository.ModelUsage;
import com.devmeter.repo.LlmCallRepository.ProjectUsage;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class LlmCallRepositoryTest {

    static final Instant DAY1 = Instant.parse("2026-10-01T10:00:00Z");
    static final Instant DAY2 = Instant.parse("2026-10-02T10:00:00Z");
    static final Instant FROM = Instant.parse("2026-10-01T00:00:00Z");
    static final Instant TO = Instant.parse("2026-10-03T00:00:00Z");

    @Autowired
    UserRepository users;

    @Autowired
    LlmCallRepository calls;

    @Autowired
    EntityManager em;

    UUID userId;

    @BeforeEach
    void seed() {
        userId = users.save(User.builder().email("calls-" + UUID.randomUUID() + "@example.com").build()).getId();
        UUID otherUserId = users.save(User.builder().email("other-" + UUID.randomUUID() + "@example.com").build()).getId();

        save(userId, "claude-sonnet", Provider.ANTHROPIC, 100, 50, "0.010000", "web", DAY1);
        save(userId, "claude-sonnet", Provider.ANTHROPIC, 200, 100, "0.020000", "web", DAY2);
        save(userId, "gpt-x", Provider.OPENAI, 10, 5, "0.001500", null, DAY2);
        // Outside the range, and another user's call: both must be ignored.
        save(userId, "gpt-x", Provider.OPENAI, 999, 999, "9.000000", "web", TO);
        save(otherUserId, "gpt-x", Provider.OPENAI, 999, 999, "9.000000", "web", DAY1);

        em.clear();
    }

    @Test
    void savesAndReadsAllFields() {
        LlmCall found = calls.findCalls(userId, DAY1, DAY2, PageRequest.of(0, 10)).getContent().getFirst();

        assertThat(found.getModel()).isEqualTo("claude-sonnet");
        assertThat(found.getProvider()).isEqualTo(Provider.ANTHROPIC);
        assertThat(found.getInputTokens()).isEqualTo(100);
        assertThat(found.getOutputTokens()).isEqualTo(50);
        assertThat(found.getCostUsd()).isEqualByComparingTo("0.01");
        assertThat(found.getLatencyMs()).isEqualTo(420);
        assertThat(found.getProjectTag()).isEqualTo("web");
        assertThat(found.getCreatedAt()).isEqualTo(DAY1);
    }

    @Test
    void unknownProviderInDatabaseReadsAsOther() {
        em.createNativeQuery("update llm_calls set provider = 'NewLab' where user_id = :userId")
                .setParameter("userId", userId)
                .executeUpdate();
        em.clear();

        assertThat(calls.findCalls(userId, FROM, TO, PageRequest.of(0, 10)))
                .extracting(LlmCall::getProvider)
                .containsOnly(Provider.OTHER);
    }

    @Test
    void findCallsIsNewestFirstAndPaginated() {
        Page<LlmCall> page = calls.findCalls(userId, FROM, TO, PageRequest.of(0, 2));

        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getContent()).extracting(LlmCall::getCreatedAt).containsExactly(DAY2, DAY2);
    }

    @Test
    void totalCost() {
        assertThat(calls.totalCost(userId, FROM, TO)).isEqualByComparingTo("0.0315");
        assertThat(calls.totalCost(UUID.randomUUID(), FROM, TO)).isEqualByComparingTo("0");
    }

    @Test
    void usageByModel() {
        List<ModelUsage> rows = calls.usageByModel(userId, FROM, TO);

        assertThat(rows).extracting(ModelUsage::getModel).containsExactly("claude-sonnet", "gpt-x");
        ModelUsage sonnet = rows.getFirst();
        assertThat(sonnet.getCalls()).isEqualTo(2);
        assertThat(sonnet.getInputTokens()).isEqualTo(300);
        assertThat(sonnet.getOutputTokens()).isEqualTo(150);
        assertThat(sonnet.getCostUsd()).isEqualByComparingTo("0.03");
    }

    @Test
    void usageByProject() {
        List<ProjectUsage> rows = calls.usageByProject(userId, FROM, TO);

        assertThat(rows).extracting(ProjectUsage::getProjectTag).containsExactly("web", null);
        assertThat(rows.getFirst().getCalls()).isEqualTo(2);
        assertThat(rows.get(1).getCostUsd()).isEqualByComparingTo("0.0015");
    }

    @Test
    void usageByDay() {
        List<DailyUsage> rows = calls.usageByDay(userId, FROM, TO, "UTC");

        assertThat(rows).extracting(DailyUsage::getDay)
                .containsExactly(LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-02"));
        DailyUsage day2 = rows.get(1);
        assertThat(day2.getCalls()).isEqualTo(2);
        assertThat(day2.getInputTokens()).isEqualTo(210);
        assertThat(day2.getOutputTokens()).isEqualTo(105);
        assertThat(day2.getCostUsd()).isEqualByComparingTo("0.0215");
    }

    private void save(UUID owner, String model, Provider provider, int in, int out,
                      String cost, String projectTag, Instant createdAt) {
        LlmCall call = calls.save(LlmCall.builder()
                .userId(owner)
                .model(model)
                .provider(provider)
                .inputTokens(in)
                .outputTokens(out)
                .costUsd(new BigDecimal(cost))
                .latencyMs(420)
                .projectTag(projectTag)
                .build());
        em.flush();
        // @CreationTimestamp sets "now" on insert; backdate so the range queries are deterministic.
        em.createNativeQuery("update llm_calls set created_at = :ts where id = :id")
                .setParameter("ts", createdAt)
                .setParameter("id", call.getId())
                .executeUpdate();
    }
}
