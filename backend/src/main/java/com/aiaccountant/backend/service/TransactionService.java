package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Transaction;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.TransactionMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.MultiValueMap;

@Service
public class TransactionService {
    private static final int MAX_COMMIT_BATCH = 200;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> VALID_TYPES = Set.of("income", "expense");

    private final TransactionMapper transactionMapper;
    private final CategoryService categoryService;

    public TransactionService(TransactionMapper transactionMapper, CategoryService categoryService) {
        this.transactionMapper = transactionMapper;
        this.categoryService = categoryService;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> commitRecognizedDrafts(Long userId, Map<String, Object> body) {
        Object raw = RequestValues.first(body, "drafts", "transactions");
        if (!(raw instanceof List<?> items) || items.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "drafts are required");
        }
        if (items.size() > MAX_COMMIT_BATCH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "too many drafts in one commit");
        }

        List<Map<String, Object>> created = new ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> map)) throw new ApiException(HttpStatus.BAD_REQUEST, "draft is invalid");
            Transaction tx = normalizeDraft(userId, (Map<String, Object>) map);
            transactionMapper.insert(tx);
            created.add(Rows.transaction(transactionMapper.findActiveByIdAndUser(tx.getId(), userId)));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("transactions", created);
        out.put("count", created.size());
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    public Map<String, Object> list(Long userId, MultiValueMap<String, String> query) {
        QueryFilters filters = parseFilters(query);
        List<Transaction> matched = transactionMapper.selectList(filteredQuery(userId, filters));
        int total = matched.size();
        int from = Math.min((filters.page() - 1) * filters.pageSize(), total);
        int to = Math.min(from + filters.pageSize(), total);
        List<Transaction> pageRows = from >= to ? Collections.emptyList() : matched.subList(from, to);

        BigDecimal income = sum(matched, "income");
        BigDecimal expense = sum(matched, "expense");

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("income", income);
        totals.put("expense", expense);
        totals.put("net", income.subtract(expense));
        totals.put("count", total);

        int totalPages = total == 0 ? 0 : (int) Math.ceil(total / (double) filters.pageSize());
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", filters.page());
        pagination.put("pageSize", filters.pageSize());
        pagination.put("total", total);
        pagination.put("totalPages", totalPages);
        pagination.put("hasNext", filters.page() < totalPages);
        pagination.put("hasPrevious", filters.page() > 1 && totalPages > 0);

        Map<String, Object> filterMap = new LinkedHashMap<>();
        filterMap.put("type", filters.type());
        filterMap.put("category", filters.category());
        filterMap.put("search", filters.search());
        filterMap.put("startDate", filters.startDate() == null ? null : filters.startDate().toString());
        filterMap.put("endDate", filters.endDate() == null ? null : filters.endDate().toString());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("transactions", pageRows.stream().map(Rows::transaction).toList());
        out.put("pagination", pagination);
        out.put("totals", totals);
        out.put("filters", filterMap);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> create(Long userId, Map<String, Object> body) {
        Transaction tx = normalizeTransaction(userId, body, false);
        transactionMapper.insert(tx);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("transaction", Rows.transaction(transactionMapper.findActiveByIdAndUser(tx.getId(), userId)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> update(Long userId, Long id, Map<String, Object> body) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "transaction id is invalid");
        if (body == null || body.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "transaction update is empty");

        Transaction tx = transactionMapper.findActiveByIdAndUser(id, userId);
        if (tx == null) throw new ApiException(HttpStatus.NOT_FOUND, "transaction not found");

        if (body.containsKey("type")) {
            String type = RequestValues.trimToNull(RequestValues.first(body, "type"));
            if (type == null || !VALID_TYPES.contains(type)) throw new ApiException(HttpStatus.BAD_REQUEST, "invalid transaction type");
            tx.setType(type);
        }

        if (RequestValues.hasAny(body, "category", "categoryName")) {
            String category = RequestValues.trimToNull(RequestValues.first(body, "category", "categoryName"));
            if (category == null) throw new ApiException(HttpStatus.BAD_REQUEST, "category is required");
            tx.setCategory(category);
        }

        if (body.containsKey("amount")) {
            BigDecimal amount = RequestValues.decimal(RequestValues.first(body, "amount"));
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be greater than 0");
            tx.setAmount(amount);
        }

        if (RequestValues.hasAny(body, "date", "transactionDate")) {
            LocalDateTime date = RequestValues.dateTime(RequestValues.first(body, "date", "transactionDate"));
            if (date == null) throw new ApiException(HttpStatus.BAD_REQUEST, "date is invalid");
            tx.setDate(date);
        }

        if (RequestValues.hasAny(body, "description", "memo", "note")) {
            tx.setDescription(RequestValues.trimToNull(RequestValues.first(body, "description", "memo", "note")));
        }

        tx.setUpdatedAt(LocalDateTime.now());
        transactionMapper.updateById(tx);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("transaction", Rows.transaction(transactionMapper.findActiveByIdAndUser(id, userId)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> delete(Long userId, Long id) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "transaction id is invalid");
        Transaction tx = transactionMapper.findActiveByIdAndUser(id, userId);
        if (tx == null) throw new ApiException(HttpStatus.NOT_FOUND, "transaction not found");

        LocalDateTime now = LocalDateTime.now();
        transactionMapper.softDeleteByIdAndUser(id, userId, now);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("deleted", true);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    private Transaction normalizeDraft(Long userId, Map<String, Object> body) {
        return normalizeTransaction(userId, body, true);
    }

    private Transaction normalizeTransaction(Long userId, Map<String, Object> body, boolean resolveCategory) {
        if (body == null) throw new ApiException(HttpStatus.BAD_REQUEST, "draft is invalid");
        Object confirmed = RequestValues.first(body, "confirmed", "isConfirmed");
        if (confirmed != null && !RequestValues.bool(confirmed)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "draft must be confirmed before commit");
        }

        String type = RequestValues.trimToNull(RequestValues.first(body, "type"));
        String category = RequestValues.trimToNull(RequestValues.first(body, "category", "categoryName"));
        BigDecimal amount = RequestValues.decimal(RequestValues.first(body, "amount"));
        LocalDateTime date = RequestValues.dateTime(RequestValues.first(body, "date", "transactionDate"));

        if (type == null || !VALID_TYPES.contains(type)) throw new ApiException(HttpStatus.BAD_REQUEST, "invalid transaction type");
        if (category == null) throw new ApiException(HttpStatus.BAD_REQUEST, "category is required");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be greater than 0");
        if (date == null) throw new ApiException(HttpStatus.BAD_REQUEST, "date is invalid");

        Transaction tx = new Transaction();
        tx.setUserId(userId);
        tx.setType(type);
        tx.setCategory(resolveCategory ? categoryService.resolveCategoryName(userId, category, type) : category);
        tx.setAmount(amount);
        tx.setDescription(RequestValues.trimToNull(RequestValues.first(body, "description", "memo", "note")));
        tx.setDate(date);
        return tx;
    }

    private LambdaQueryWrapper<Transaction> filteredQuery(Long userId, QueryFilters filters) {
        LambdaQueryWrapper<Transaction> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Transaction::getUserId, userId)
            .isNull(Transaction::getDeletedAt);

        if (filters.type() != null) wrapper.eq(Transaction::getType, filters.type());
        if (filters.category() != null) wrapper.eq(Transaction::getCategory, filters.category());
        if (filters.startDate() != null) wrapper.ge(Transaction::getDate, filters.startDate().atStartOfDay());
        if (filters.endDate() != null) wrapper.lt(Transaction::getDate, filters.endDate().plusDays(1).atStartOfDay());
        if (filters.search() != null) {
            String searchPattern = "%" + filters.search().toLowerCase() + "%";
            wrapper.and(w -> w.apply("LOWER(description) LIKE {0}", searchPattern)
                .or()
                .apply("LOWER(category) LIKE {0}", searchPattern));
        }

        wrapper.orderByDesc(Transaction::getDate).orderByDesc(Transaction::getId);
        return wrapper;
    }

    private QueryFilters parseFilters(MultiValueMap<String, String> query) {
        int page = positiveInt(RequestValues.firstQuery(query, "page"), 1, Integer.MAX_VALUE);
        int pageSize = positiveInt(RequestValues.firstQuery(query, "pageSize", "limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        String type = RequestValues.trimToNull(RequestValues.firstQuery(query, "type"));
        if (type != null && !"all".equalsIgnoreCase(type)) {
            if (!VALID_TYPES.contains(type)) throw new ApiException(HttpStatus.BAD_REQUEST, "invalid transaction type");
        } else {
            type = null;
        }

        String category = RequestValues.trimToNull(RequestValues.firstQuery(query, "category", "categoryName"));
        if (category != null && "all".equalsIgnoreCase(category)) category = null;

        String search = RequestValues.trimToNull(RequestValues.firstQuery(query, "search", "q", "keyword"));
        LocalDate startDate = parseDate(RequestValues.firstQuery(query, "startDate", "from"));
        LocalDate endDate = parseDate(RequestValues.firstQuery(query, "endDate", "to"));
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "endDate 不能早于 startDate");
        }

        return new QueryFilters(page, pageSize, type, category, search, startDate, endDate);
    }

    private int positiveInt(String raw, int fallback, int max) {
        try {
            int value = Integer.parseInt(String.valueOf(raw));
            if (value <= 0) return fallback;
            return Math.min(value, max);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private LocalDate parseDate(String raw) {
        String value = RequestValues.trimToNull(raw);
        if (value == null) return null;
        try {
            return LocalDate.parse(value.substring(0, Math.min(10, value.length())));
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date is invalid");
        }
    }

    private BigDecimal sum(List<Transaction> transactions, String type) {
        return transactions.stream()
            .filter(t -> type.equals(t.getType()))
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private record QueryFilters(
        int page,
        int pageSize,
        String type,
        String category,
        String search,
        LocalDate startDate,
        LocalDate endDate
    ) {
    }
}
