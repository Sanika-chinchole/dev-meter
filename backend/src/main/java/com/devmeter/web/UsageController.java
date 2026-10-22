package com.devmeter.web;

import com.devmeter.security.CurrentUser;
import com.devmeter.service.UsageReport;
import com.devmeter.service.UsageService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequiredArgsConstructor
public class UsageController {

    private final UsageService usage;

    /** Dashboard data for the current user. {@code from} and {@code to} are inclusive ISO dates; default is the last 30 days. */
    @GetMapping("/usage")
    public UsageReport usage(CurrentUser user,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                             @RequestParam(defaultValue = "UTC") String tz) {
        return usage.report(user.id(), from, to, tz);
    }
}
