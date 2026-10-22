package com.devmeter.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ProviderConverter implements AttributeConverter<Provider, String> {

    @Override
    public String convertToDatabaseColumn(Provider provider) {
        return provider == null ? null : provider.value();
    }

    @Override
    public Provider convertToEntityAttribute(String dbValue) {
        return dbValue == null ? null : Provider.fromValue(dbValue);
    }
}
