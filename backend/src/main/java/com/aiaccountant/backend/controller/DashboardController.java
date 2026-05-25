package com.aiaccountant.backend.controller;

import com.aiaccountant.backend.security.SecurityUtils;
import com.aiaccountant.backend.service.DashboardService;
import java.util.Map;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {
    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/api/dashboard/summary")
    public Map<String, Object> summary(@RequestParam MultiValueMap<String, String> query) {
        return dashboardService.summary(SecurityUtils.requireUserId(), query);
    }

    @GetMapping("/api/dashboard/charts")
    public Map<String, Object> charts(@RequestParam MultiValueMap<String, String> query) {
        return dashboardService.charts(SecurityUtils.requireUserId(), query);
    }
}
