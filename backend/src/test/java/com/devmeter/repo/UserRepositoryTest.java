package com.devmeter.repo;

import com.devmeter.domain.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class UserRepositoryTest {

    @Autowired
    UserRepository users;

    @Autowired
    EntityManager em;

    @Test
    void savesAndFindsByEmail() {
        String email = "user-" + UUID.randomUUID() + "@example.com";
        User saved = users.save(User.builder().email(email).name("Test User").build());
        em.flush();
        em.clear();

        User found = users.findByEmail(email).orElseThrow();

        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getName()).isEqualTo("Test User");
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(users.findByEmail("missing-" + email)).isEmpty();
    }
}
