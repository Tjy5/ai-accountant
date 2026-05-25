package com.aiaccountant.backend;

import com.aiaccountant.backend.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BackendJavaApiIntegrationTest {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppProperties properties;

    @Test
    void authAiRecognitionCommitAndDashboardFlow() throws Exception {
        mvc.perform(get("/api/dashboard/summary")).andExpect(status().isUnauthorized());

        String token = register("core.flow@example.com");
        String auth = "Bearer " + token;

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "core.flow@example.com", "password", "password123"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token", notNullValue()))
            .andExpect(jsonPath("$.user.email", is("core.flow@example.com")));

        mvc.perform(get("/api/auth/me").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email", is("core.flow@example.com")));

        mvc.perform(post("/api/ai/analyze")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("text", "餐饮 30 元"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.intent", is("bookkeeping")))
            .andExpect(jsonPath("$.drafts", hasSize(1)))
            .andExpect(jsonPath("$.drafts[0].category", is("餐饮")))
            .andExpect(jsonPath("$.needsClarification", is(false)))
            .andExpect(jsonPath("$.timestamp", notNullValue()));

        mvc.perform(post("/api/ai/analyze-image")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("image", "data:image/png;base64,AAAA", "text", "工资 1000 元"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.intent", is("bookkeeping")))
            .andExpect(jsonPath("$.drafts", hasSize(1)))
            .andExpect(jsonPath("$.drafts[0].type", is("income")))
            .andExpect(jsonPath("$.drafts[0].category", is("工资")));

        mvc.perform(post("/api/ai/transactions/commit")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("drafts", List.of(
                    Map.of("confirmed", true, "type", "expense", "category", "餐饮", "amount", 30, "description", "lunch", "date", "2026-01-10"),
                    Map.of("confirmed", true, "type", "income", "category", "工资", "amount", 1000, "description", "salary", "date", "2026-01-11")
                )))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.transactions", hasSize(2)))
            .andExpect(jsonPath("$.count", is(2)));

        mvc.perform(get("/api/dashboard/summary?startDate=2026-01-01&endDate=2026-01-31").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.range.startDate", is("2026-01-01")))
            .andExpect(jsonPath("$.totals.income", is(1000.0)))
            .andExpect(jsonPath("$.totals.expense", is(30.0)))
            .andExpect(jsonPath("$.totals.net", is(970.0)))
            .andExpect(jsonPath("$.totals.count", is(2)))
            .andExpect(jsonPath("$.recentTransactions", hasSize(2)))
            .andExpect(jsonPath("$.recentTransactions[0].type", is("income")))
            .andExpect(jsonPath("$.recentTransactions[1].type", is("expense")))
            .andExpect(jsonPath("$.updatedAt", notNullValue()))
            .andExpect(jsonPath("$.timestamp", notNullValue()));

        mvc.perform(get("/api/dashboard/charts?startDate=2026-01-01&endDate=2026-01-31").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.monthlyTrend", hasSize(1)))
            .andExpect(jsonPath("$.monthlyTrend[0].month", is("2026-01")))
            .andExpect(jsonPath("$.categoryShare", hasSize(1)))
            .andExpect(jsonPath("$.categoryShare[0].category", is("餐饮")));

        String otherAuth = "Bearer " + register("core.other@example.com");
        mvc.perform(get("/api/dashboard/summary?startDate=2026-01-01&endDate=2026-01-31").header("Authorization", otherAuth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totals.count", is(0)))
            .andExpect(jsonPath("$.totals.income", is(0)))
            .andExpect(jsonPath("$.totals.expense", is(0)))
            .andExpect(jsonPath("$.recentTransactions", hasSize(0)));
    }

    @Test
    void defaultCategoryFallbackAndAtomicCommitAreEnforced() throws Exception {
        String auth = "Bearer " + register("fallback.atomic@example.com");

        mvc.perform(post("/api/ai/analyze")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("text", "unmatched 12"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.drafts[0].category", is("其他")));

        mvc.perform(post("/api/ai/transactions/commit")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("drafts", List.of(
                    Map.of("confirmed", true, "type", "expense", "category", "餐饮", "amount", 12, "description", "valid", "date", "2026-02-01"),
                    Map.of("confirmed", true, "type", "expense", "category", "餐饮", "amount", -1, "description", "invalid", "date", "2026-02-01")
                )))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("amount must be greater than 0")));

        mvc.perform(get("/api/dashboard/summary?startDate=2026-02-01&endDate=2026-02-28").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totals.count", is(0)));

        mvc.perform(post("/api/ai/transactions/commit")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("drafts", List.of(
                    Map.of("confirmed", true, "type", "expense", "category", "Does Not Exist", "amount", 8, "description", "fallback", "date", "2026-02-03")
                )))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.transactions[0].category", is("其他")));
    }

    @Test
    void aiProviderAndInputValidationReturnControlledJsonErrors() throws Exception {
        String auth = "Bearer " + register("validation.errors@example.com");
        String originalApiKey = properties.getAi().getApiKey();
        try {
            properties.getAi().setApiKey("");
            mvc.perform(post("/api/ai/analyze")
                    .header("Authorization", auth)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("text", "午餐 30"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("AI provider is not configured")))
                .andExpect(jsonPath("$.code", is("AI_PROVIDER_NOT_CONFIGURED")))
                .andExpect(jsonPath("$.error", not(containsString("test-api-key"))));
        } finally {
            properties.getAi().setApiKey(originalApiKey);
        }

        mvc.perform(post("/api/ai/analyze")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("text is required")));

        mvc.perform(post("/api/ai/analyze-image")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("image", "data:text/plain;base64,AAAA"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("image format is not supported")));

        mvc.perform(post("/api/ai/transactions/commit")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("drafts", List.of(
                    Map.of("confirmed", true, "type", "expense", "category", "餐饮", "amount", 20, "description", "missing date")
                )))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("date is invalid")));
    }

    @Test
    void removedManagementAndCompatibilityEndpointsAreNotExposed() throws Exception {
        String auth = "Bearer " + register("removed.surface@example.com");

        mvc.perform(get("/api/categories").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(post("/api/transactions").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(get("/api/budgets").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(get("/api/preferences").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(get("/api/ai/settings").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(post("/api/analyze-text").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(post("/api/ai/chat").header("Authorization", auth)).andExpect(status().isNotFound());
        mvc.perform(post("/api/ai/transcribe").header("Authorization", auth)).andExpect(status().isNotFound());
    }

    @Test
    void authValidationAndInvalidTokenReturnJsonErrors() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "not-an-email", "password", "short"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("参数无效")))
            .andExpect(jsonPath("$.details.email", notNullValue()))
            .andExpect(jsonPath("$.details.password", notNullValue()));

        register("auth.errors@example.com");

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "auth.errors@example.com", "password", "wrong-password"))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error", is("邮箱或密码错误")));

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer definitely.invalid.token"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error", is("无效的令牌")))
            .andExpect(jsonPath("$.code", is("INVALID_TOKEN")));
    }

    private String register(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "password", "password123", "name", "Test User"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token", notNullValue()))
            .andExpect(jsonPath("$.user.email", is(email)))
            .andReturn();
        return read(result).get("token").asText();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode read(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
