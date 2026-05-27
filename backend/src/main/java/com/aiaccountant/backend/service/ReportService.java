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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

@Service
public class ReportService {
    private static final int MAX_CATEGORY_ROWS = 8;
    private static final int MAX_LARGE_EXPENSES = 5;

    private final TransactionMapper transactionMapper;
    private final BudgetMapper budgetMapper;

    public ReportService(TransactionMapper transactionMapper, BudgetMapper budgetMapper) {
        this.transactionMapper = transactionMapper;
        this.budgetMapper = budgetMapper;
    }

    public Map<String, Object> overview(Long userId, MultiValueMap<String, String> query) {
        DateRange range = range(query);
        YearMonth budgetMonth = parseMonth(firstQuery(query, "month", "periodMonth", "period_month"), YearMonth.from(range.end()));
        List<Transaction> transactions = transactionMapper.findByDateRange(
            userId,
            range.start().atStartOfDay(),
            range.end().plusDays(1).atStartOfDay()
        );

        List<Map<String, Object>> monthlyTrend = monthlyTrend(range, transactions);
        List<Map<String, Object>> categoryBreakdown = categoryBreakdown(transactions);
        Map<String, Object> budgetHealth = budgetHealth(userId, budgetMonth);
        Map<String, Object> summary = summary(transactions);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("range", range.map(budgetMonth));
        out.put("summary", summary);
        out.put("monthlyTrend", monthlyTrend);
        out.put("categoryBreakdown", categoryBreakdown);
        out.put("budgetHealth", budgetHealth);
        out.put("largeExpenses", largeExpenses(transactions));
        out.put("insights", insights(summary, monthlyTrend, categoryBreakdown, budgetHealth));
        out.put("updatedAt", updatedAt(transactions));
        out.put("timestamp", System.currentTimeMillis());
        out.put("cache", Map.of("hit", false));
        return out;
    }

    private Map<String, Object> summary(List<Transaction> transactions) {
        BigDecimal income = sum(transactions, "income");
        BigDecimal expense = sum(transactions, "expense");
        BigDecimal net = income.subtract(expense);
        long expenseCount = transactions.stream().filter(t -> "expense".equals(t.getType())).count();
        BigDecimal averageExpense = expenseCount == 0
            ? BigDecimal.ZERO
            : expense.divide(BigDecimal.valueOf(expenseCount), 2, RoundingMode.HALF_UP);
        BigDecimal largestExpense = transactions.stream()
            .filter(t -> "expense".equals(t.getType()))
            .map(Transaction::getAmount)
            .max(Comparator.naturalOrder())
            .orElse(BigDecimal.ZERO);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("income", income);
        out.put("expense", expense);
        out.put("net", net);
        out.put("transactionCount", transactions.size());
        out.put("expenseCount", expenseCount);
        out.put("averageExpense", averageExpense);
        out.put("largestExpense", largestExpense);
        out.put("savingsRate", percent(net, income));
        return out;
    }

    private List<Map<String, Object>> monthlyTrend(DateRange range, List<Transaction> transactions) {
        Map<YearMonth, List<Transaction>> byMonth = transactions.stream()
            .collect(Collectors.groupingBy(t -> YearMonth.from(t.getDate().toLocalDate())));
        List<Map<String, Object>> out = new ArrayList<>();
        YearMonth cursor = YearMonth.from(range.start());
        YearMonth endMonth = YearMonth.from(range.end());

        while (!cursor.isAfter(endMonth)) {
            List<Transaction> rows = byMonth.getOrDefault(cursor, List.of());
            BigDecimal income = sum(rows, "income");
            BigDecimal expense = sum(rows, "expense");
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("month", cursor.toString());
            item.put("income", income);
            item.put("expense", expense);
            item.put("net", income.subtract(expense));
            item.put("count", rows.size());
            out.add(item);
            cursor = cursor.plusMonths(1);
        }

        return out;
    }

    private List<Map<String, Object>> categoryBreakdown(List<Transaction> transactions) {
        Map<String, List<Transaction>> byCategory = transactions.stream()
            .filter(t -> "expense".equals(t.getType()))
            .collect(Collectors.groupingBy(Transaction::getCategory));
        BigDecimal totalExpense = byCategory.values().stream()
            .flatMap(List::stream)
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return byCategory.entrySet().stream()
            .map(entry -> {
                BigDecimal total = entry.getValue().stream()
                    .map(Transaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("category", entry.getKey());
                item.put("total", total);
                item.put("percentage", percent(total, totalExpense));
                item.put("transactionCount", entry.getValue().size());
                item.put("averageAmount", entry.getValue().isEmpty()
                    ? BigDecimal.ZERO
                    : total.divide(BigDecimal.valueOf(entry.getValue().size()), 2, RoundingMode.HALF_UP));
                return item;
            })
            .sorted((a, b) -> ((BigDecimal) b.get("total")).compareTo((BigDecimal) a.get("total")))
            .limit(MAX_CATEGORY_ROWS)
            .toList();
    }

    private Map<String, Object> budgetHealth(Long userId, YearMonth month) {
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
        Map<String, BigDecimal> spentByCategory = new LinkedHashMap<>();
        for (Transaction transaction : transactionMapper.findByDateRange(userId, start, end)) {
            if (!"expense".equals(transaction.getType())) continue;
            spentByCategory.merge(transaction.getCategory(), transaction.getAmount(), BigDecimal::add);
        }

        List<Map<String, Object>> categories = budgetMapper.findActiveByUserAndMonth(userId, month.toString()).stream()
            .map(budget -> budgetRow(budget, spentByCategory.getOrDefault(budget.getCategory(), BigDecimal.ZERO)))
            .sorted((a, b) -> Integer.compare((int) b.get("progress"), (int) a.get("progress")))
            .toList();

        BigDecimal totalBudget = BigDecimal.ZERO;
        BigDecimal totalSpent = BigDecimal.ZERO;
        int overBudget = 0;
        int watch = 0;
        int onTrack = 0;
        for (Map<String, Object> category : categories) {
            totalBudget = totalBudget.add((BigDecimal) category.get("amount"));
            totalSpent = totalSpent.add((BigDecimal) category.get("spent"));
            String status = String.valueOf(category.get("status"));
            if ("over".equals(status)) overBudget++;
            else if ("watch".equals(status)) watch++;
            else onTrack++;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month.toString());
        out.put("totalBudget", totalBudget);
        out.put("totalSpent", totalSpent);
        out.put("remaining", totalBudget.subtract(totalSpent));
        out.put("progress", percent(totalSpent, totalBudget));
        out.put("count", categories.size());
        out.put("overBudget", overBudget);
        out.put("watch", watch);
        out.put("onTrack", onTrack);
        out.put("categories", categories);
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

    private List<Map<String, Object>> largeExpenses(List<Transaction> transactions) {
        return transactions.stream()
            .filter(t -> "expense".equals(t.getType()))
            .sorted(Comparator.comparing(Transaction::getAmount).reversed().thenComparing(Transaction::getDate, Comparator.reverseOrder()))
            .limit(MAX_LARGE_EXPENSES)
            .map(Rows::transaction)
            .toList();
    }

    private List<Map<String, Object>> insights(
        Map<String, Object> summary,
        List<Map<String, Object>> monthlyTrend,
        List<Map<String, Object>> categoryBreakdown,
        Map<String, Object> budgetHealth
    ) {
        List<Map<String, Object>> out = new ArrayList<>();
        int savingsRate = (int) summary.get("savingsRate");
        int overBudget = (int) budgetHealth.get("overBudget");

        if (categoryBreakdown.isEmpty()) {
            out.add(insight("Quiet report window", "No expense categories were recorded in this range yet.", "neutral"));
        } else {
            Map<String, Object> topCategory = categoryBreakdown.get(0);
            out.add(insight(
                "Top spending lane",
                topCategory.get("category") + " leads this report at " + topCategory.get("percentage") + "% of expenses.",
                "focus"
            ));
        }

        Map<String, Object> bestMonth = monthlyTrend.stream()
            .max(Comparator.comparing(item -> (BigDecimal) item.get("net")))
            .orElse(null);
        if (bestMonth != null) {
            out.add(insight("Best cashflow month", bestMonth.get("month") + " had the strongest net movement.", "good"));
        }

        if (overBudget > 0) {
            out.add(insight("Budget attention", overBudget + " budget line needs attention for " + budgetHealth.get("month") + ".", "warning"));
        } else if ((int) budgetHealth.get("count") > 0) {
            out.add(insight("Budget cushion", "All tracked budget lines are still inside their monthly caps.", "good"));
        }

        if (savingsRate < 0) {
            out.add(insight("Cashflow dip", "Expenses are higher than income in this report range.", "warning"));
        } else if (savingsRate >= 20) {
            out.add(insight("Healthy savings rate", "This range keeps a savings rate of " + savingsRate + "%.", "good"));
        }

        return out.stream().limit(4).toList();
    }

    private Map<String, Object> insight(String title, String body, String tone) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("title", title);
        out.put("body", body);
        out.put("tone", tone);
        return out;
    }

    private BigDecimal sum(List<Transaction> transactions, String type) {
        return transactions.stream()
            .filter(t -> type.equals(t.getType()))
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private int percent(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) <= 0) return 0;
        return numerator.multiply(BigDecimal.valueOf(100))
            .divide(denominator, 0, RoundingMode.HALF_UP)
            .intValue();
    }

    private String updatedAt(List<Transaction> transactions) {
        return transactions.stream()
            .map(t -> t.getUpdatedAt() == null ? t.getCreatedAt() : t.getUpdatedAt())
            .filter(v -> v != null)
            .max(Comparator.naturalOrder())
            .map(Object::toString)
            .orElse(null);
    }

    private DateRange range(MultiValueMap<String, String> query) {
        LocalDate now = LocalDate.now();
        LocalDate fallbackStart = now.minusMonths(5).withDayOfMonth(1);
        LocalDate fallbackEnd = now.withDayOfMonth(now.lengthOfMonth());
        LocalDate start = parseDate(firstQuery(query, "startDate", "from"), fallbackStart);
        LocalDate end = parseDate(firstQuery(query, "endDate", "to"), fallbackEnd);
        if (end.isBefore(start)) throw new ApiException(HttpStatus.BAD_REQUEST, "endDate 不能早于 startDate");
        return new DateRange(start, end);
    }

    private LocalDate parseDate(String raw, LocalDate fallback) {
        String value = RequestValues.trimToNull(raw);
        if (value == null) return fallback;
        try {
            return LocalDate.parse(value.substring(0, Math.min(10, value.length())));
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date is invalid");
        }
    }

    private YearMonth parseMonth(String raw, YearMonth fallback) {
        String value = RequestValues.trimToNull(raw);
        if (value == null) return fallback;
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

    private record DateRange(LocalDate start, LocalDate end) {
        Map<String, Object> map(YearMonth budgetMonth) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("startDate", start.toString());
            out.put("endDate", end.toString());
            out.put("budgetMonth", budgetMonth.toString());
            return out;
        }
    }
}
