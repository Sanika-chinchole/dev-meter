package com.devmeter.service;

import java.math.BigDecimal;

/** Model list price in USD per million tokens. */
public record ModelPrice(BigDecimal inPerMTok, BigDecimal outPerMTok) {

    static ModelPrice of(String inPerMTok, String outPerMTok) {
        return new ModelPrice(new BigDecimal(inPerMTok), new BigDecimal(outPerMTok));
    }
}
