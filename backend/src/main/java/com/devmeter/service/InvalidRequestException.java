package com.devmeter.service;

/** Bad client input detected by a service; the web layer turns it into a 400. */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
