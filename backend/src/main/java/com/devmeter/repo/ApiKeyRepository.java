package com.devmeter.repo;

import com.devmeter.domain.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    List<ApiKey> findByUserId(UUID userId);

    Optional<ApiKey> findByKeyHash(String keyHash);
}
