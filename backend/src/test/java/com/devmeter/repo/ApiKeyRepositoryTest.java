package com.devmeter.repo;

import com.devmeter.domain.ApiKey;
import com.devmeter.domain.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ApiKeyRepositoryTest {

    @Autowired
    UserRepository users;

    @Autowired
    ApiKeyRepository apiKeys;

    @Autowired
    EntityManager em;

    @Test
    void savesAndFindsByUserAndHash() {
        User user = users.save(User.builder().email("key-" + UUID.randomUUID() + "@example.com").build());
        String hash = "hash-" + UUID.randomUUID();
        // Postgres stores microseconds, so truncate to compare exactly after the round trip.
        Instant lastUsed = Instant.now().truncatedTo(ChronoUnit.MICROS);
        ApiKey saved = apiKeys.save(ApiKey.builder()
                .userId(user.getId())
                .keyHash(hash)
                .label("laptop")
                .lastUsed(lastUsed)
                .build());
        em.flush();
        em.clear();

        ApiKey found = apiKeys.findByKeyHash(hash).orElseThrow();

        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getUserId()).isEqualTo(user.getId());
        assertThat(found.getLabel()).isEqualTo("laptop");
        assertThat(found.getLastUsed()).isEqualTo(lastUsed);
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(apiKeys.findByUserId(user.getId())).extracting(ApiKey::getId).containsExactly(saved.getId());
    }
}
