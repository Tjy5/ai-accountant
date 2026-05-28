package com.aiaccountant.backend.controller;

import com.aiaccountant.backend.security.SecurityUtils;
import com.aiaccountant.backend.service.AiSettingsService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiSettingsController {
    private final AiSettingsService aiSettingsService;

    public AiSettingsController(AiSettingsService aiSettingsService) {
        this.aiSettingsService = aiSettingsService;
    }

    @GetMapping("/api/settings/ai")
    public Map<String, Object> get() {
        return aiSettingsService.get(SecurityUtils.requireUserId());
    }

    @PatchMapping("/api/settings/ai")
    public Map<String, Object> update(@RequestBody Map<String, Object> body) {
        return aiSettingsService.update(SecurityUtils.requireUserId(), body);
    }

    @PostMapping("/api/settings/ai/test")
    public Map<String, Object> test(@RequestBody(required = false) Map<String, Object> body) {
        return aiSettingsService.test(SecurityUtils.requireUserId(), body);
    }
}
