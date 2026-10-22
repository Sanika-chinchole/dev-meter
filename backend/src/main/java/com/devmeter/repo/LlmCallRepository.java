package com.devmeter.repo;

import com.devmeter.domain.LlmCall;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Usage queries all take a half-open time range: {@code from <= createdAt < to}.
 */
public interface LlmCallRepository extends JpaRepository<LlmCall, UUID> {

    @Query("""
            select c from LlmCall c
            where c.userId = :userId and c.createdAt >= :from and c.createdAt < :to
            order by c.createdAt desc
            """)
    Page<LlmCall> findCalls(@Param("userId") UUID userId,
                            @Param("from") Instant from,
                            @Param("to") Instant to,
                            Pageable pageable);

    @Query("""
            select coalesce(sum(c.costUsd), 0) from LlmCall c
            where c.userId = :userId and c.createdAt >= :from and c.createdAt < :to
            """)
    BigDecimal totalCost(@Param("userId") UUID userId,
                         @Param("from") Instant from,
                         @Param("to") Instant to);

    @Query("""
            select c.model as model, count(c) as calls,
                   sum(c.inputTokens) as inputTokens, sum(c.outputTokens) as outputTokens,
                   sum(c.costUsd) as costUsd
            from LlmCall c
            where c.userId = :userId and c.createdAt >= :from and c.createdAt < :to
            group by c.model
            order by sum(c.costUsd) desc
            """)
    List<ModelUsage> usageByModel(@Param("userId") UUID userId,
                                  @Param("from") Instant from,
                                  @Param("to") Instant to);

    /** Calls without a projectTag are grouped under a null projectTag. */
    @Query("""
            select c.projectTag as projectTag, count(c) as calls,
                   sum(c.inputTokens) as inputTokens, sum(c.outputTokens) as outputTokens,
                   sum(c.costUsd) as costUsd
            from LlmCall c
            where c.userId = :userId and c.createdAt >= :from and c.createdAt < :to
            group by c.projectTag
            order by sum(c.costUsd) desc
            """)
    List<ProjectUsage> usageByProject(@Param("userId") UUID userId,
                                      @Param("from") Instant from,
                                      @Param("to") Instant to);

    /**
     * Daily totals, bucketed by calendar day in {@code zone} (an IANA ID such as "UTC" or "Asia/Kolkata").
     * Days with no calls are omitted.
     */
    @Query(value = """
            select cast(created_at at time zone :zone as date) as "day",
                   count(*) as "calls",
                   sum(input_tokens) as "inputTokens", sum(output_tokens) as "outputTokens",
                   sum(cost_usd) as "costUsd"
            from llm_calls
            where user_id = :userId and created_at >= :from and created_at < :to
            group by 1
            order by 1
            """, nativeQuery = true)
    List<DailyUsage> usageByDay(@Param("userId") UUID userId,
                                @Param("from") Instant from,
                                @Param("to") Instant to,
                                @Param("zone") String zone);

    interface ModelUsage {
        String getModel();
        long getCalls();
        long getInputTokens();
        long getOutputTokens();
        BigDecimal getCostUsd();
    }

    interface ProjectUsage {
        String getProjectTag();
        long getCalls();
        long getInputTokens();
        long getOutputTokens();
        BigDecimal getCostUsd();
    }

    interface DailyUsage {
        LocalDate getDay();
        long getCalls();
        long getInputTokens();
        long getOutputTokens();
        BigDecimal getCostUsd();
    }
}
