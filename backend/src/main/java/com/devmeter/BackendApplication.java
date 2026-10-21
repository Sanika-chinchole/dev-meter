package com.devmeter;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		// Windows reports the legacy "Asia/Calcutta" ID, which PostgreSQL rejects on connect.
		if ("Asia/Calcutta".equals(TimeZone.getDefault().getID())) {
			TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
		}
		SpringApplication.run(BackendApplication.class, args);
	}

}
