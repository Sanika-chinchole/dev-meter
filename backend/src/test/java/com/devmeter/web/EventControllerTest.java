package com.devmeter.web;

import com.devmeter.domain.LlmCall;
import com.devmeter.domain.Provider;
import com.devmeter.repo.LlmCallRepository;
import com.devmeter.repo.UserRepository;
import com.devmeter.security.JwtService;
import com.devmeter.service.UserService;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EventControllerTest {

    static final String VALID = """
            {"model":"claude-sonnet","provider":"anthropic","inputTokens":1200,"outputTokens":300,
             "latencyMs":850,"projectTag":"devmeter"}""";

    @Autowired
    MockMvc mvc;

    @Autowired
    LlmCallRepository calls;

    @Autowired
    UserRepository users;

    @Autowired
    EntityManager em;

    @Autowired
    UserService userService;

    @Autowired
    JwtService jwt;

    final String email = "events-" + UUID.randomUUID() + "@example.com";
    String token;

    @BeforeEach
    void login() {
        token = jwt.issue(userService.findOrCreateByEmail(email));
    }

    @Test
    void recordsCallForHeaderUserWithServerSideCost() throws Exception {
        // 1200 * $3/M + 300 * $15/M = 0.0036 + 0.0045
        String body = postEvent(VALID)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.costUsd").value(0.0081))
                .andExpect(jsonPath("$.priced").value(true))
                .andReturn().getResponse().getContentAsString();
        // Read back what the database stored, not the cached entity (createdAt is set on insert).
        em.flush();
        em.clear();

        LlmCall saved = calls.findById(UUID.fromString(JsonPath.read(body, "$.id"))).orElseThrow();
        assertThat(saved.getUserId()).isEqualTo(users.findByEmail(email).orElseThrow().getId());
        assertThat(saved.getProvider()).isEqualTo(Provider.ANTHROPIC);
        assertThat(saved.getCostUsd()).isEqualByComparingTo("0.0081");
        assertThat(saved.getLatencyMs()).isEqualTo(850);
        assertThat(saved.getProjectTag()).isEqualTo("devmeter");
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void unknownModelIsStoredUnpricedAndUnknownProviderAsOther() throws Exception {
        String body = postEvent("""
                {"model":"mystery-9000","provider":"NewLab","inputTokens":10,"outputTokens":10,"projectTag":"  "}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.costUsd").value(0.0))
                .andExpect(jsonPath("$.priced").value(false))
                .andReturn().getResponse().getContentAsString();

        LlmCall saved = calls.findById(UUID.fromString(JsonPath.read(body, "$.id"))).orElseThrow();
        assertThat(saved.getProvider()).isEqualTo(Provider.OTHER);
        assertThat(saved.getProjectTag()).isNull();
        assertThat(saved.getLatencyMs()).isNull();
    }

    @Test
    void rejectsPromptTextAndAnyUnknownOrNestedField() throws Exception {
        String[] bodies = {
                VALID.replace("}", ",\"content\":\"secret prompt\"}"),
                VALID.replace("}", ",\"prompt\":\"secret prompt\"}"),
                VALID.replace("}", ",\"messages\":[{\"role\":\"user\",\"content\":\"secret\"}]}"),
                VALID.replace("}", ",\"meta\":{\"text\":\"secret\"}}"),
                VALID.replace("\"claude-sonnet\"", "{\"name\":\"claude-sonnet\"}"),
                VALID.replace("\"claude-sonnet\"", "[\"claude-sonnet\"]"),
        };
        for (String body : bodies) {
            postEvent(body)
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))));
        }
        assertThat(users.findByEmail(email)).isPresent(); // authenticated fine; only the body was rejected
        assertThat(calls.findAll()).noneMatch(c -> c.getUserId().equals(users.findByEmail(email).get().getId()));
    }

    @Test
    void validatesFields() throws Exception {
        postEvent("""
                {"model":" ","provider":"","inputTokens":-1,"outputTokens":200000000,"latencyMs":-5}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Request validation failed"))
                .andExpect(jsonPath("$.errors[*].field").value(hasItem("model")))
                .andExpect(jsonPath("$.errors[*].field").value(hasItem("provider")))
                .andExpect(jsonPath("$.errors[*].field").value(hasItem("inputTokens")))
                .andExpect(jsonPath("$.errors[*].field").value(hasItem("outputTokens")))
                .andExpect(jsonPath("$.errors[*].field").value(hasItem("latencyMs")));

        postEvent("""
                {"model":"claude-sonnet","provider":"anthropic"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field").value(hasItem("inputTokens")));
    }

    @Test
    void missingOrInvalidTokenIs401() throws Exception {
        mvc.perform(post("/events").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        mvc.perform(post("/events").header("Authorization", "Bearer not-a-jwt")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isUnauthorized());

        // The old debug header no longer authenticates anyone.
        mvc.perform(post("/events").header("X-Debug-User", email)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void pingStaysOpen() throws Exception {
        mvc.perform(get("/ping")).andExpect(status().isOk());
    }

    private ResultActions postEvent(String json) throws Exception {
        return mvc.perform(post("/events")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }
}
