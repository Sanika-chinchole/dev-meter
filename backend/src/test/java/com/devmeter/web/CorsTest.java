package com.devmeter.web;

import com.devmeter.security.JwtService;
import com.devmeter.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CorsTest {

    static final String DASHBOARD = "http://localhost:5173";

    @Autowired
    MockMvc mvc;

    @Autowired
    UserService users;

    @Autowired
    JwtService jwt;

    @Test
    void dashboardPreflightIsAllowedWithoutToken() throws Exception {
        for (String path : new String[] {"/usage", "/auth/me"}) {
            mvc.perform(options(path)
                            .header("Origin", DASHBOARD)
                            .header("Access-Control-Request-Method", "GET")
                            .header("Access-Control-Request-Headers", "authorization"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", DASHBOARD))
                    .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
        }
    }

    @Test
    void dashboardGetCarriesCorsHeader() throws Exception {
        String token = jwt.issue(users.findOrCreateByEmail("cors-" + UUID.randomUUID() + "@example.com"));
        mvc.perform(get("/usage").header("Origin", DASHBOARD).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", DASHBOARD));
    }

    @Test
    void otherOriginsMethodsAndPathsGetNoCorsAccess() throws Exception {
        mvc.perform(options("/usage")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));

        mvc.perform(options("/usage")
                        .header("Origin", DASHBOARD)
                        .header("Access-Control-Request-Method", "DELETE"))
                .andExpect(status().isForbidden());

        // /events is for the extension (not a browser page), so it has no CORS config at all.
        mvc.perform(options("/events")
                        .header("Origin", DASHBOARD)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
