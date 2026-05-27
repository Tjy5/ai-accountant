package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Budget;
import com.aiaccountant.backend.entity.Transaction;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.BudgetMapper;
import com.aiaccountant.backend.mapper.TransactionMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.MultiValueMap;

@Service
public class BudgetService {
    private static final String ACTIVE_KEY = "ACTIVE";
    private static final Set<String> ICONS = Set.of(
        "utensils",
        "bus",
        "shopping-bag",
        "gamepad",
        "receipt",
        "heart-pulse",
        "wallet",
        "briefcase",
        "gift",
        "sparkles",
        "tag",
        "more-horizontal"
    );
    private static final Set<String> COLORS = Set.of(
        "#FF8C94",
        "#64B5F6",
        "#FFD54F",
        "#BA68C8",
        "#7ACB9C",
        "#FFB87A",
        "#A1887F",
        "#4DB6AC",
        "#F27C8B",
        "#8C9EFF"
    );

    private final BudgetMapper budgetMapper;
    private final TransactionMapper transactionMapper;

    public BudgetService(BudgetMapper budgetMapper, TransactionMapper transactionMapper) {
        this.budgetMapper = budgetMapper;
        this.transactionMapper = transactionMapper;
    }

    public Map<String, Object> list(Long userId, MultiValueMap<String, String> query) {
        YearMonth month = parseMonth(firstQuery(query, "month", "periodMonth", "period_month"), true);
        Map<String, BigDecimal> spentByCategory = spentByCategory(userId, month);
        List<Map<String, Object>> rows = budgetMapper.findActiveByUserAndMonth(userId, month.toString()).stream()
            .map(budget -> budgetRow(budget, spentByCategory.getOrDefault(budget.getCategory(), BigDecimal.ZERO)))
            .toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("budgets", rows);
        out.put("summary", summary(month, rows));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> create(Long userId, Map<String, Object> body) {
        Budget budget = normalizeBudget(userId, null, body, false);
        try {
            budgetMapper.insert(budget);
        } catch (DuplicateKeyException ex) {
            throw duplicateBudgetException();
        }

        Budget saved = budgetMapper.findActiveByIdAndUser(budget.getId(), userId);
        YearMonth month = parseMonth(saved.getPeriodMonth(), false);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("budget", budgetRow(saved, spentByCategory(userId, month).getOrDefault(saved.getCategory(), BigDecimal.ZERO)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> update(Long userId, Long id, Map<String, Object> body) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "budget id is invalid");
        if (body == null || body.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "budget update is empty");

        Budget budget = budgetMapper.findActiveByIdAndUser(id, userId);
        if (budget == null) throw new ApiException(HttpStatus.NOT_FOUND, "budget not found");

        normalizeBudget(userId, budget, body, true);
        budget.setUpdatedAt(LocalDateTime.now());
        try {
            budgetMapper.updateById(budget);
        } catch (DuplicateKeyException ex) {
            throw duplicateBudgetException();
        }

        Budget saved = budgetMapper.findActiveByIdAndUser(id, userId);
        YearMonth month = parseMonth(saved.getPeriodMonth(), false);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("budget", budgetRow(saved, spentByCategory(userId, month).getOrDefault(saved.getCategory(), BigDecimal.ZERO)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> delete(Long userId, Long id) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "budget id is invalid");
        Budget budget = budgetMapper.findActiveByIdAndUser(id, userId);
        if (budget == null) throw new ApiException(HttpStatus.NOT_FOUND, "budget not found");

        budgetMapper.softDeleteByIdAndUser(id, userId, LocalDateTime.now());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("deleted", true);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    private Budget normalizeBudget(Long userId, Budget existing, Map<String, Object> body, boolean partial) {
        if (body == null) throw new ApiException(HttpStatus.BAD_REQUEST, "budget is invalid");
        Budget budget = existing == null ? new Budget() : existing;
        if (existing == null) {
            budget.setUserId(userId);
        }
        budget.setActiveKey(ACTIVE_KEY);

        if (!partial || hasAny(body, "category", "categoryName", "name")) {
            String category = RequestValues.trimToNull(RequestValues.first(body, "category", "categoryName", "name"));
            if (category == null) throw new ApiException(HttpStatus.BAD_REQUEST, "category is required");
            if (category.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "category is too long");
            budget.setCategory(category);
        }

        if (!partial || hasAny(body, "amount", "budget", "budgetAmount")) {
            BigDecimal amount = RequestValues.decimal(RequestValues.first(body, "amount", "budget", "budgetAmount"));
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be greater than 0");
            }
            budget.setAmount(amount);
        }

        if (!partial || hasAny(body, "month", "periodMonth", "period_month")) {
            YearMonth month = parseMonth(RequestValues.trimToNull(RequestValues.first(body, "month", "periodMonth", "period_month")), false);
            budget.setPeriodMonth(month.toString());
        }

        if (!partial || hasAny(body, "icon")) {
            String icon = RequestValues.trimToNull(RequestValues.first(body, "icon"));
            budget.setIcon(icon == null || !ICONS.contains(icon) ? "tag" : icon);
        }

        if (!partial || hasAny(body, "color")) {
            String color = RequestValues.trimToNull(RequestValues.first(body, "color"));
            budget.setColor(color == null || !COLORS.contains(color) ? "#FF8C94" : color);
        }

        if (!partial || hasAny(body, "notes", "description")) {
            String notes = RequestValues.trimToNull(RequestValues.first(body, "notes", "description"));
            if (notes != null && notes.length() > 500) throw new ApiException(HttpStatus.BAD_REQUEST, "budget notes are too long");
            budget.setNotes(notes);
        }

        Budget duplicate = existing == null
            ? budgetMapper.findActiveByCategoryAndMonth(userId, budget.getCategory(), budget.getPeriodMonth())
            : budgetMapper.findActiveByCategoryAndMonthExcludingId(userId, budget.getCategory(), budget.getPeriodMonth(), existing.getId());
        if (duplicate != null) throw new ApiException(HttpStatus.CONFLICT, "budget already exists for category and month");

        return budget;
    }

    private ApiException duplicateBudgetException() {
        return new ApiException(HttpStatus.CONFLICT, "budget already exists for category and month");
    }

    private Map<String, BigDecimal> spentByCategory(Long userId, YearMonth month) {
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        for (Transaction transaction : transactionMapper.findByDateRange(userId, start, end)) {
            if (!"expense".equals(transaction.getType())) continue;
            out.merge(transaction.getCategory(), transaction.getAmount(), BigDecimal::add);
        }
        return out;
    }

    private Map<String, Object> budgetRow(Budget budget, BigDecimal spent) {
        BigDecimal amount = budget.getAmount() == null ? BigDecimal.ZERO : budget.getAmount();
        BigDecimal actualSpent = spent == null ? BigDecimal.ZERO : spent;
        BigDecimal remaining = amount.subtract(actualSpent);
        int progress = percent(actualSpent, amount);

        Map<String, Object> out = Rows.budget(budget);
        out.put("spent", actualSpent);
        out.put("remaining", remaining);
        out.put("progress", progress);
        out.put("status", progress > 100 ? "over" : progress >= 80 ? "watch" : "on_track");
        return out;
    }

    private Map<String, Object> summary(YearMonth month, List<Map<String, Object>> rows) {
        BigDecimal totalBudget = BigDecimal.ZERO;
        BigDecimal totalSpent = BigDecimal.ZERO;
        int overBudget = 0;

        for (Map<String, Object> row : rows) {
            totalBudget = totalBudget.add((BigDecimal) row.get("amount"));
            totalSpent = totalSpent.add((BigDecimal) row.get("spent"));
            if ("over".equals(row.get("status"))) overBudget++;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month.toString());
        out.put("totalBudget", totalBudget);
        out.put("totalSpent", totalSpent);
        out.put("remaining", totalBudget.subtract(totalSpent));
        out.put("progress", percent(totalSpent, totalBudget));
        out.put("count", rows.size());
        out.put("overBudget", overBudget);
        return out;
    }

    private int percent(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) <= 0) return 0;
        return numerator.multiply(BigDecimal.valueOf(100))
            .divide(denominator, 0, RoundingMode.HALF_UP)
            .intValue();
    }

    private YearMonth parseMonth(String raw, boolean useCurrentAsFallback) {
        String value = RequestValues.trimToNull(raw);
        if (value == null && useCurrentAsFallback) return YearMonth.now();
        if (value == null) throw new ApiException(HttpStatus.BAD_REQUEST, "month is required");
        try {
            return YearMonth.parse(value);
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "month is invalid");
        }
    }

    private String firstQuery(MultiValueMap<String, String> query, String... keys) {
        if (query == null) return null;
        for (String key : keys) {
            String value = query.getFirst(key);
            if (value != null) return value;
        }
        return null;
    }

    private boolean hasAny(Map<String, Object> body, String... keys) {
        if (body == null) return false;
        return Stream.of(keys).anyMatch(body::containsKey);
    }
}
