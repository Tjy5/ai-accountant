package com.aiaccountant.backend.controller;

import com.aiaccountant.backend.security.SecurityUtils;
import com.aiaccountant.backend.service.SettingsService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {
    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public Map<String, Object> get() {
        return settingsService.get(SecurityUtils.requireUserId());
    }

    @PatchMapping
    public Map<String, Object> update(@RequestBody Map<String, Object> body) {
        return settingsService.update(SecurityUtils.requireUserId(), body);
    }
}
