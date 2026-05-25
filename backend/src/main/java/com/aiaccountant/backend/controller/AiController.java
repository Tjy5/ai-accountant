package com.aiaccountant.backend.controller;

import com.aiaccountant.backend.security.SecurityUtils;
import com.aiaccountant.backend.service.AiBookkeepingService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiController {
    private final AiBookkeepingService aiService;

    public AiController(AiBookkeepingService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/api/ai/analyze")
    public Map<String, Object> analyze(@RequestBody Map<String, Object> body) {
        return aiService.analyze(SecurityUtils.requireUserId(), body);
    }

    @PostMapping("/api/ai/analyze-image")
    public Map<String, Object> analyzeImage(@RequestBody Map<String, Object> body) {
        return aiService.analyzeImage(SecurityUtils.requireUserId(), body);
    }

    @PostMapping("/api/ai/transactions/commit")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> commit(@RequestBody Map<String, Object> body) {
        return aiService.commit(SecurityUtils.requireUserId(), body);
    }
}
