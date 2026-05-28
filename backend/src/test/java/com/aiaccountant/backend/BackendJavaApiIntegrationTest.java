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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

        mvc.perform(get("/api/dashboard/summary?startDate=bad-date").header("Authorization", auth))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("date is invalid")));

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
    void transactionCrudSupportsFilteringTotalsAndSoftDelete() throws Exception {
        String auth = "Bearer " + register("transactions.crud@example.com");

        MvcResult coffeeResult = mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Food & Dining",
                    "amount", 6.50,
                    "description", "Latte with toast",
                    "date", "2026-03-02"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.transaction.id", notNullValue()))
            .andExpect(jsonPath("$.transaction.type", is("expense")))
            .andExpect(jsonPath("$.transaction.category", is("Food & Dining")))
            .andReturn();

        long coffeeId = read(coffeeResult).get("transaction").get("id").asLong();

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "income",
                    "category", "Salary",
                    "amount", 5200,
                    "description", "Monthly Salary",
                    "date", "2026-03-01"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/transactions?startDate=2026-03-01&endDate=2026-03-31&page=1&pageSize=1").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.transactions", hasSize(1)))
            .andExpect(jsonPath("$.pagination.total", is(2)))
            .andExpect(jsonPath("$.pagination.totalPages", is(2)))
            .andExpect(jsonPath("$.pagination.hasNext", is(true)))
            .andExpect(jsonPath("$.totals.income", is(5200.0)))
            .andExpect(jsonPath("$.totals.expense", is(6.5)))
            .andExpect(jsonPath("$.totals.net", is(5193.5)));

        mvc.perform(get("/api/transactions")
                .queryParam("type", "expense")
                .queryParam("category", "Food & Dining")
                .queryParam("search", "latte")
                .header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.transactions", hasSize(1)))
            .andExpect(jsonPath("$.transactions[0].id", is((int) coffeeId)))
            .andExpect(jsonPath("$.filters.type", is("expense")))
            .andExpect(jsonPath("$.filters.category", is("Food & Dining")));

        mvc.perform(patch("/api/transactions/{id}", coffeeId)
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "amount", 8.25,
                    "description", "Latte and cake",
                    "category", "Cafe"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.transaction.amount", is(8.25)))
            .andExpect(jsonPath("$.transaction.description", is("Latte and cake")))
            .andExpect(jsonPath("$.transaction.category", is("Cafe")));

        String otherAuth = "Bearer " + register("transactions.other@example.com");
        mvc.perform(patch("/api/transactions/{id}", coffeeId)
                .header("Authorization", otherAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("amount", 1))))
            .andExpect(status().isNotFound());

        mvc.perform(delete("/api/transactions/{id}", coffeeId).header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted", is(true)))
            .andExpect(jsonPath("$.id", is((int) coffeeId)));

        mvc.perform(get("/api/transactions?search=Latte").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.transactions", hasSize(0)))
            .andExpect(jsonPath("$.pagination.total", is(0)));
    }

    @Test
    void categoryCrudSupportsStatsDefaultsAndUserIsolation() throws Exception {
        String auth = "Bearer " + register("categories.crud@example.com");

        MvcResult defaultsResult = mvc.perform(get("/api/categories").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.categories", hasSize(6)))
            .andExpect(jsonPath("$.stats.total", is(6)))
            .andExpect(jsonPath("$.stats.default", is(6)))
            .andReturn();

        long defaultId = findCategoryId(read(defaultsResult), "餐饮");
        mvc.perform(delete("/api/categories/{id}", defaultId).header("Authorization", auth))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("default categories cannot be deleted")));

        MvcResult createdResult = mvc.perform(post("/api/categories")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "name", "Subscriptions",
                    "type", "expense",
                    "icon", "receipt",
                    "color", "#BA68C8",
                    "description", "Apps and streaming"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.category.id", notNullValue()))
            .andExpect(jsonPath("$.category.name", is("Subscriptions")))
            .andExpect(jsonPath("$.category.type", is("expense")))
            .andExpect(jsonPath("$.category.is_default", is(false)))
            .andReturn();

        long categoryId = read(createdResult).get("category").get("id").asLong();

        mvc.perform(post("/api/categories")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "name", "Subscriptions",
                    "type", "expense",
                    "icon", "receipt",
                    "color", "#BA68C8"
                ))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error", is("category name already exists")));

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Subscriptions",
                    "amount", 18.75,
                    "description", "Streaming plan",
                    "date", "2026-04-10"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/categories")
                .queryParam("type", "expense")
                .queryParam("search", "Sub")
                .header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.categories", hasSize(1)))
            .andExpect(jsonPath("$.categories[0].name", is("Subscriptions")))
            .andExpect(jsonPath("$.categories[0].transaction_count", is(1)))
            .andExpect(jsonPath("$.categories[0].expense_total", is(18.75)))
            .andExpect(jsonPath("$.stats.total", is(1)));

        mvc.perform(patch("/api/categories/{id}", categoryId)
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "name", "Subscriptions & Apps",
                    "icon", "sparkles",
                    "color", "#8C9EFF",
                    "description", "Recurring apps"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.category.name", is("Subscriptions & Apps")))
            .andExpect(jsonPath("$.category.icon", is("sparkles")))
            .andExpect(jsonPath("$.category.color", is("#8C9EFF")));

        String otherAuth = "Bearer " + register("categories.other@example.com");
        mvc.perform(patch("/api/categories/{id}", categoryId)
                .header("Authorization", otherAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("description", "not yours"))))
            .andExpect(status().isNotFound());

        mvc.perform(delete("/api/categories/{id}", categoryId).header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted", is(true)))
            .andExpect(jsonPath("$.id", is((int) categoryId)));

        mvc.perform(get("/api/categories?search=Subscriptions").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.categories", hasSize(0)));
    }

    @Test
    void budgetCrudSupportsMonthlyTotalsAndUserIsolation() throws Exception {
        String auth = "Bearer " + register("budgets.crud@example.com");

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Food & Dining",
                    "amount", 40,
                    "description", "Dinner",
                    "date", "2026-05-03"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Food & Dining",
                    "amount", 25.50,
                    "description", "Groceries",
                    "date", "2026-05-12"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Transport",
                    "amount", 12,
                    "description", "Bus pass",
                    "date", "2026-05-15"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "income",
                    "category", "Food & Dining",
                    "amount", 900,
                    "description", "Shared label income",
                    "date", "2026-05-20"
                ))))
            .andExpect(status().isCreated());

        MvcResult createdResult = mvc.perform(post("/api/budgets")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "category", "Food & Dining",
                    "amount", 100,
                    "month", "2026-05",
                    "icon", "utensils",
                    "color", "#FF8C94",
                    "notes", "Keep groceries steady"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.budget.id", notNullValue()))
            .andExpect(jsonPath("$.budget.category", is("Food & Dining")))
            .andExpect(jsonPath("$.budget.period_month", is("2026-05")))
            .andExpect(jsonPath("$.budget.spent", is(65.5)))
            .andExpect(jsonPath("$.budget.remaining", is(34.5)))
            .andExpect(jsonPath("$.budget.progress", is(66)))
            .andReturn();

        long budgetId = read(createdResult).get("budget").get("id").asLong();

        mvc.perform(post("/api/budgets")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "category", "Transport",
                    "amount", 50,
                    "month", "2026-05",
                    "icon", "bus",
                    "color", "#64B5F6"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/budgets?month=2026-05").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.budgets", hasSize(2)))
            .andExpect(jsonPath("$.summary.month", is("2026-05")))
            .andExpect(jsonPath("$.summary.totalBudget", is(150.0)))
            .andExpect(jsonPath("$.summary.totalSpent", is(77.5)))
            .andExpect(jsonPath("$.summary.remaining", is(72.5)))
            .andExpect(jsonPath("$.summary.progress", is(52)))
            .andExpect(jsonPath("$.summary.count", is(2)))
            .andExpect(jsonPath("$.summary.overBudget", is(0)));

        mvc.perform(post("/api/budgets")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "category", "Food & Dining",
                    "amount", 120,
                    "month", "2026-05"
                ))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error", is("budget already exists for category and month")));

        mvc.perform(patch("/api/budgets/{id}", budgetId)
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "amount", 60.25,
                    "notes", "Tighter food cap"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.budget.amount", is(60.25)))
            .andExpect(jsonPath("$.budget.spent", is(65.5)))
            .andExpect(jsonPath("$.budget.remaining", is(-5.25)))
            .andExpect(jsonPath("$.budget.progress", is(109)))
            .andExpect(jsonPath("$.budget.status", is("over")));

        String otherAuth = "Bearer " + register("budgets.other@example.com");
        mvc.perform(patch("/api/budgets/{id}", budgetId)
                .header("Authorization", otherAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("amount", 1))))
            .andExpect(status().isNotFound());

        mvc.perform(delete("/api/budgets/{id}", budgetId).header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted", is(true)))
            .andExpect(jsonPath("$.id", is((int) budgetId)));

        mvc.perform(get("/api/budgets?month=2026-05").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.budgets", hasSize(1)))
            .andExpect(jsonPath("$.budgets[0].category", is("Transport")));

        mvc.perform(post("/api/budgets")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "category", "Food & Dining",
                    "amount", 90,
                    "month", "2026-05"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.budget.category", is("Food & Dining")))
            .andExpect(jsonPath("$.budget.period_month", is("2026-05")));

        mvc.perform(get("/api/budgets?month=2026-05").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.budgets", hasSize(2)));
    }

    @Test
    void goalCrudSupportsSummaryFilteringAndUserIsolation() throws Exception {
        String auth = "Bearer " + register("goals.crud@example.com");

        MvcResult createdResult = mvc.perform(post("/api/goals")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "title", "Japan Trip",
                    "targetAmount", 2400,
                    "savedAmount", 900,
                    "targetDate", "2026-08-15",
                    "status", "active",
                    "icon", "plane",
                    "color", "#64B5F6",
                    "notes", "Flights and hotels"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.goal.id", notNullValue()))
            .andExpect(jsonPath("$.goal.title", is("Japan Trip")))
            .andExpect(jsonPath("$.goal.target_amount", is(2400.0)))
            .andExpect(jsonPath("$.goal.saved_amount", is(900.0)))
            .andExpect(jsonPath("$.goal.remaining", is(1500.0)))
            .andExpect(jsonPath("$.goal.progress", is(38)))
            .andExpect(jsonPath("$.goal.status", is("active")))
            .andReturn();

        long goalId = read(createdResult).get("goal").get("id").asLong();

        mvc.perform(post("/api/goals")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "title", "Emergency Fund",
                    "targetAmount", 1000,
                    "savedAmount", 1000,
                    "status", "completed",
                    "icon", "piggy-bank",
                    "color", "#7ACB9C"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.goal.progress", is(100)))
            .andExpect(jsonPath("$.goal.pace", is("complete")));

        mvc.perform(get("/api/goals").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.goals", hasSize(2)))
            .andExpect(jsonPath("$.summary.totalTarget", is(3400.0)))
            .andExpect(jsonPath("$.summary.totalSaved", is(1900.0)))
            .andExpect(jsonPath("$.summary.remaining", is(1500.0)))
            .andExpect(jsonPath("$.summary.progress", is(56)))
            .andExpect(jsonPath("$.summary.count", is(2)))
            .andExpect(jsonPath("$.summary.active", is(1)))
            .andExpect(jsonPath("$.summary.completed", is(1)));

        mvc.perform(get("/api/goals")
                .queryParam("status", "active")
                .queryParam("search", "Japan")
                .header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.goals", hasSize(1)))
            .andExpect(jsonPath("$.goals[0].title", is("Japan Trip")))
            .andExpect(jsonPath("$.filters.status", is("active")))
            .andExpect(jsonPath("$.filters.search", is("Japan")));

        mvc.perform(post("/api/goals")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "title", "Japan Trip",
                    "targetAmount", 3000
                ))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error", is("goal title already exists")));

        mvc.perform(patch("/api/goals/{id}", goalId)
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "savedAmount", 2450,
                    "status", "completed",
                    "notes", "Fully funded"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.goal.saved_amount", is(2450.0)))
            .andExpect(jsonPath("$.goal.remaining", is(0)))
            .andExpect(jsonPath("$.goal.progress", is(102)))
            .andExpect(jsonPath("$.goal.status", is("completed")))
            .andExpect(jsonPath("$.goal.pace", is("complete")));

        String otherAuth = "Bearer " + register("goals.other@example.com");
        mvc.perform(patch("/api/goals/{id}", goalId)
                .header("Authorization", otherAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("savedAmount", 1))))
            .andExpect(status().isNotFound());

        mvc.perform(delete("/api/goals/{id}", goalId).header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted", is(true)))
            .andExpect(jsonPath("$.id", is((int) goalId)));

        mvc.perform(get("/api/goals?search=Japan").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.goals", hasSize(0)));

        mvc.perform(post("/api/goals")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "title", "Japan Trip",
                    "targetAmount", 3200
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.goal.title", is("Japan Trip")));
    }

    @Test
    void reportOverviewAggregatesTrendsCategoriesBudgetsAndUserIsolation() throws Exception {
        String auth = "Bearer " + register("reports.overview@example.com");

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "income",
                    "category", "Salary",
                    "amount", 3000,
                    "description", "June salary",
                    "date", "2026-06-01"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Food & Dining",
                    "amount", 120,
                    "description", "June groceries",
                    "date", "2026-06-05"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Transport",
                    "amount", 80,
                    "description", "June train pass",
                    "date", "2026-06-12"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "income",
                    "category", "Salary",
                    "amount", 3200,
                    "description", "July salary",
                    "date", "2026-07-01"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Food & Dining",
                    "amount", 150,
                    "description", "July dinner party",
                    "date", "2026-07-10"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/transactions")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "type", "expense",
                    "category", "Shopping",
                    "amount", 50,
                    "description", "July supplies",
                    "date", "2026-07-14"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/budgets")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "category", "Food & Dining",
                    "amount", 100,
                    "month", "2026-07",
                    "icon", "utensils",
                    "color", "#FF8C94"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/budgets")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "category", "Shopping",
                    "amount", 60,
                    "month", "2026-07",
                    "icon", "shopping-bag",
                    "color", "#FFD54F"
                ))))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/reports")
                .queryParam("startDate", "2026-06-01")
                .queryParam("endDate", "2026-07-31")
                .queryParam("month", "2026-07")
                .header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.range.startDate", is("2026-06-01")))
            .andExpect(jsonPath("$.range.endDate", is("2026-07-31")))
            .andExpect(jsonPath("$.range.budgetMonth", is("2026-07")))
            .andExpect(jsonPath("$.summary.income", is(6200.0)))
            .andExpect(jsonPath("$.summary.expense", is(400.0)))
            .andExpect(jsonPath("$.summary.net", is(5800.0)))
            .andExpect(jsonPath("$.summary.transactionCount", is(6)))
            .andExpect(jsonPath("$.summary.expenseCount", is(4)))
            .andExpect(jsonPath("$.summary.averageExpense", is(100.0)))
            .andExpect(jsonPath("$.summary.largestExpense", is(150.0)))
            .andExpect(jsonPath("$.summary.savingsRate", is(94)))
            .andExpect(jsonPath("$.monthlyTrend", hasSize(2)))
            .andExpect(jsonPath("$.monthlyTrend[0].month", is("2026-06")))
            .andExpect(jsonPath("$.monthlyTrend[0].income", is(3000.0)))
            .andExpect(jsonPath("$.monthlyTrend[0].expense", is(200.0)))
            .andExpect(jsonPath("$.monthlyTrend[1].month", is("2026-07")))
            .andExpect(jsonPath("$.monthlyTrend[1].income", is(3200.0)))
            .andExpect(jsonPath("$.monthlyTrend[1].expense", is(200.0)))
            .andExpect(jsonPath("$.categoryBreakdown[0].category", is("Food & Dining")))
            .andExpect(jsonPath("$.categoryBreakdown[0].total", is(270.0)))
            .andExpect(jsonPath("$.categoryBreakdown[0].percentage", is(68)))
            .andExpect(jsonPath("$.budgetHealth.month", is("2026-07")))
            .andExpect(jsonPath("$.budgetHealth.totalBudget", is(160.0)))
            .andExpect(jsonPath("$.budgetHealth.totalSpent", is(200.0)))
            .andExpect(jsonPath("$.budgetHealth.progress", is(125)))
            .andExpect(jsonPath("$.budgetHealth.overBudget", is(1)))
            .andExpect(jsonPath("$.budgetHealth.watch", is(1)))
            .andExpect(jsonPath("$.budgetHealth.categories", hasSize(2)))
            .andExpect(jsonPath("$.budgetHealth.categories[0].category", is("Food & Dining")))
            .andExpect(jsonPath("$.budgetHealth.categories[0].status", is("over")))
            .andExpect(jsonPath("$.largeExpenses[0].description", is("July dinner party")))
            .andExpect(jsonPath("$.insights", hasSize(4)))
            .andExpect(jsonPath("$.updatedAt", notNullValue()))
            .andExpect(jsonPath("$.timestamp", notNullValue()));

        String otherAuth = "Bearer " + register("reports.other@example.com");
        mvc.perform(get("/api/reports")
                .queryParam("startDate", "2026-06-01")
                .queryParam("endDate", "2026-07-31")
                .queryParam("month", "2026-07")
                .header("Authorization", otherAuth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.transactionCount", is(0)))
            .andExpect(jsonPath("$.summary.income", is(0)))
            .andExpect(jsonPath("$.summary.expense", is(0)))
            .andExpect(jsonPath("$.categoryBreakdown", hasSize(0)))
            .andExpect(jsonPath("$.budgetHealth.categories", hasSize(0)));
    }

    @Test
    void settingsCanBeReadUpdatedValidatedAndAreUserScoped() throws Exception {
        String auth = "Bearer " + register("settings.owner@example.com");

        mvc.perform(get("/api/settings").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email", is("settings.owner@example.com")))
            .andExpect(jsonPath("$.user.name", is("Test User")))
            .andExpect(jsonPath("$.settings.default_currency", is("USD")))
            .andExpect(jsonPath("$.settings.month_start_day", is(1)))
            .andExpect(jsonPath("$.settings.receipt_reminders", is(true)))
            .andExpect(jsonPath("$.settings.budget_alerts", is(true)))
            .andExpect(jsonPath("$.settings.weekly_report", is(false)))
            .andExpect(jsonPath("$.settings.ai_assist_enabled", is(true)))
            .andExpect(jsonPath("$.options.currencies", hasSize(6)));

        mvc.perform(patch("/api/settings")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                    "displayName", "Mimi Ledger",
                    "defaultCurrency", "CNY",
                    "monthStartDay", 5,
                    "receiptReminders", false,
                    "budgetAlerts", true,
                    "weeklyReport", true,
                    "aiAssistEnabled", false
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.name", is("Mimi Ledger")))
            .andExpect(jsonPath("$.settings.default_currency", is("CNY")))
            .andExpect(jsonPath("$.settings.month_start_day", is(5)))
            .andExpect(jsonPath("$.settings.receipt_reminders", is(false)))
            .andExpect(jsonPath("$.settings.weekly_report", is(true)))
            .andExpect(jsonPath("$.settings.ai_assist_enabled", is(false)));

        mvc.perform(get("/api/settings").header("Authorization", auth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.name", is("Mimi Ledger")))
            .andExpect(jsonPath("$.settings.default_currency", is("CNY")))
            .andExpect(jsonPath("$.settings.month_start_day", is(5)));

        String otherAuth = "Bearer " + register("settings.other@example.com");
        mvc.perform(get("/api/settings").header("Authorization", otherAuth))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.name", is("Test User")))
            .andExpect(jsonPath("$.settings.default_currency", is("USD")))
            .andExpect(jsonPath("$.settings.month_start_day", is(1)));

        mvc.perform(patch("/api/settings")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("defaultCurrency", "BTC"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("currency is not supported")));

        mvc.perform(patch("/api/settings")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("monthStartDay", 31))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("month start day must be between 1 and 28")));
    }

    @Test
    void aiProviderSettingsCanSavePersonalKeyWithoutEncryptionKey() throws Exception {
        String auth = "Bearer " + register("plain.ai.settings@example.com");
        String originalEncryptionKey = properties.getAi().getEncryptionKey();
        try {
            properties.getAi().setEncryptionKey("");

            mvc.perform(patch("/api/settings/ai")
                    .header("Authorization", auth)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("apiKey", "plain-local-api-key-1234"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKeyConfigured", is(true)))
                .andExpect(jsonPath("$.apiKeyPreview", is("****1234")))
                .andExpect(jsonPath("$.usesUserApiKey", is(true)))
                .andExpect(jsonPath("$.encryptionConfigured", is(false)));

            mvc.perform(get("/api/settings/ai").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKeyConfigured", is(true)))
                .andExpect(jsonPath("$.apiKeyPreview", is("****1234")))
                .andExpect(jsonPath("$.usesUserApiKey", is(true)))
                .andExpect(jsonPath("$.encryptionConfigured", is(false)));
        } finally {
            properties.getAi().setEncryptionKey(originalEncryptionKey);
        }
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.warnings[0]", containsString("AI provider is not configured")))
                .andExpect(jsonPath("$.warnings[0]", not(containsString("test-api-key"))));
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
                .content(json(Map.of("email", "", "password", ""))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error", is("参数无效")))
            .andExpect(jsonPath("$.details.email", notNullValue()))
            .andExpect(jsonPath("$.details.password", notNullValue()));

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "1", "password", "1", "name", "Short User"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token", notNullValue()))
            .andExpect(jsonPath("$.user.email", is("1")));

        register("auth.errors@example.com");

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "auth.errors@example.com", "password", "wrong-password"))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error", is("账号或密码错误")));

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

    private long findCategoryId(JsonNode payload, String name) {
        for (JsonNode category : payload.get("categories")) {
            if (name.equals(category.get("name").asText())) {
                return category.get("id").asLong();
            }
        }
        throw new AssertionError("category not found: " + name);
    }
}
