package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Transaction;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.TransactionMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransactionService {
    private static final int MAX_COMMIT_BATCH = 200;
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

    private Transaction normalizeDraft(Long userId, Map<String, Object> body) {
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
        tx.setCategory(categoryService.resolveCategoryName(userId, category, type));
        tx.setAmount(amount);
        tx.setDescription(RequestValues.trimToNull(RequestValues.first(body, "description", "memo", "note")));
        tx.setDate(date);
        return tx;
    }
}
