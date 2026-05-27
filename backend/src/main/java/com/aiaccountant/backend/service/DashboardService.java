package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Transaction;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.TransactionMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;

@Service
public class DashboardService {
    private final TransactionMapper transactionMapper;

    public DashboardService(TransactionMapper transactionMapper) {
        this.transactionMapper = transactionMapper;
    }

    public Map<String, Object> summary(Long userId, MultiValueMap<String, String> query) {
        DateRange range = range(query);
        List<Transaction> transactions = transactionMapper.findByDateRange(userId, range.start().atStartOfDay(), range.end().plusDays(1).atStartOfDay());
        BigDecimal income = sum(transactions, "income");
        BigDecimal expense = sum(transactions, "expense");
        String updatedAt = transactions.stream()
            .map(t -> t.getUpdatedAt() == null ? t.getCreatedAt() : t.getUpdatedAt())
            .filter(v -> v != null)
            .max(Comparator.naturalOrder())
            .map(Object::toString)
            .orElse(null);

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("income", income);
        totals.put("expense", expense);
        totals.put("net", income.subtract(expense));
        totals.put("count", transactions.size());
        List<Map<String, Object>> recentTransactions = transactions.stream()
            .sorted(Comparator.comparing(Transaction::getDate).reversed().thenComparing(Transaction::getId, Comparator.reverseOrder()))
            .limit(6)
            .map(Rows::transaction)
            .toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("range", range.map());
        out.put("totals", totals);
        out.put("recentTransactions", recentTransactions);
        out.put("updatedAt", updatedAt);
        out.put("timestamp", System.currentTimeMillis());
        out.put("cache", Map.of("hit", false));
        return out;
    }

    public Map<String, Object> charts(Long userId, MultiValueMap<String, String> query) {
        DateRange range = range(query);
        int topN = Math.min(positiveInt(query == null ? null : query.getFirst("topN"), 10), 50);
        List<Transaction> transactions = transactionMapper.findByDateRange(userId, range.start().atStartOfDay(), range.end().plusDays(1).atStartOfDay());

        Map<YearMonth, List<Transaction>> byMonth = transactions.stream().collect(Collectors.groupingBy(t -> YearMonth.from(t.getDate().toLocalDate())));
        List<Map<String, Object>> monthlyTrend = byMonth.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> {
                BigDecimal income = sum(entry.getValue(), "income");
                BigDecimal expense = sum(entry.getValue(), "expense");
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("month", entry.getKey().toString());
                item.put("income", income);
                item.put("expense", expense);
                item.put("net", income.subtract(expense));
                return item;
            }).toList();

        Map<String, BigDecimal> expenseByCategory = transactions.stream()
            .filter(t -> "expense".equals(t.getType()))
            .collect(Collectors.groupingBy(Transaction::getCategory, Collectors.mapping(Transaction::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
        BigDecimal totalExpense = expenseByCategory.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Map<String, Object>> categoryShare = expenseByCategory.entrySet().stream()
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
            .limit(topN)
            .map(entry -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("category", entry.getKey());
                item.put("total", entry.getValue());
                double pct = totalExpense.compareTo(BigDecimal.ZERO) > 0
                    ? entry.getValue().divide(totalExpense, 4, RoundingMode.HALF_UP).doubleValue()
                    : 0;
                item.put("percentage", pct);
                return item;
            }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("range", range.map());
        out.put("monthlyTrend", monthlyTrend);
        out.put("categoryShare", categoryShare);
        out.put("timestamp", System.currentTimeMillis());
        out.put("cache", Map.of("hit", false));
        return out;
    }

    private BigDecimal sum(List<Transaction> transactions, String type) {
        return transactions.stream()
            .filter(t -> type.equals(t.getType()))
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private DateRange range(MultiValueMap<String, String> query) {
        LocalDate now = LocalDate.now();
        LocalDate start = parseDate(query == null ? null : query.getFirst("startDate"), now.withDayOfMonth(1));
        LocalDate end = parseDate(query == null ? null : query.getFirst("endDate"), now.withDayOfMonth(now.lengthOfMonth()));
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

    private int positiveInt(String raw, int fallback) {
        Integer value = RequestValues.integer(raw);
        return value == null || value <= 0 ? fallback : value;
    }

    private record DateRange(LocalDate start, LocalDate end) {
        Map<String, Object> map() {
            return Map.of("startDate", start.toString(), "endDate", end.toString());
        }
    }
}
