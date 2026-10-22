package com.devmeter.service;

import com.devmeter.domain.User;
import com.devmeter.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository users;

    /** Emails are stored trimmed and lowercased. */
    public User findOrCreateByEmail(String email) {
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return users.findByEmail(normalized).orElseGet(() -> create(normalized));
    }

    /** Called on every Google login; keeps the display name in sync with the Google profile. */
    public User upsertFromLogin(String email, String name) {
        User user = findOrCreateByEmail(email);
        if (name != null && !name.equals(user.getName())) {
            user.setName(name);
            user = users.save(user);
        }
        return user;
    }

    private User create(String email) {
        try {
            return users.saveAndFlush(User.builder().email(email).build());
        } catch (DataIntegrityViolationException race) {
            // Another request created the same user between our lookup and insert.
            return users.findByEmail(email).orElseThrow(() -> race);
        }
    }
}
