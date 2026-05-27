package com.aiaccountant.backend.controller;

import com.aiaccountant.backend.security.SecurityUtils;
import com.aiaccountant.backend.service.ReportService;
import java.util.Map;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public Map<String, Object> overview(@RequestParam MultiValueMap<String, String> query) {
        return reportService.overview(SecurityUtils.requireUserId(), query);
    }
}
