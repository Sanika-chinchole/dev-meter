package com.devmeter.web;

import com.devmeter.domain.LlmCall;
import com.devmeter.domain.Provider;
import com.devmeter.repo.LlmCallRepository;
import com.devmeter.security.CurrentUser;
import com.devmeter.service.PricingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequiredArgsConstructor
public class EventController {

    private final LlmCallRepository calls;
    private final PricingService pricing;

    /** Records one LLM call. userId comes from auth, cost from PricingService, createdAt is set on insert. */
    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse record(CurrentUser user, @Valid @RequestBody EventRequest request) {
        String model = request.model().trim();
        BigDecimal cost = pricing.computeCost(model, request.inputTokens(), request.outputTokens());
        LlmCall saved = calls.save(LlmCall.builder()
                .userId(user.id())
                .model(model)
                .provider(Provider.fromValue(request.provider()))
                .inputTokens(request.inputTokens())
                .outputTokens(request.outputTokens())
                .costUsd(cost)
                .latencyMs(request.latencyMs())
                .projectTag(blankToNull(request.projectTag()))
                .build());
        return new EventResponse(saved.getId(), cost, pricing.isKnownModel(model));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
