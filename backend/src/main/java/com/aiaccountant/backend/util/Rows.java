package com.aiaccountant.backend.util;

import com.aiaccountant.backend.entity.Budget;
import com.aiaccountant.backend.entity.Category;
import com.aiaccountant.backend.entity.Transaction;
import com.aiaccountant.backend.entity.User;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

public final class Rows {
    private Rows() {
    }

    public static Map<String, Object> user(User user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", user.getId());
        out.put("email", user.getEmail());
        out.put("name", user.getName());
        out.put("created_at", user.getCreatedAt());
        return out;
    }

    public static Map<String, Object> transaction(Transaction t) {
        Map<String, Object> out = base(t.getId(), t.getCreatedAt(), t.getUpdatedAt(), t.getDeletedAt());
        out.put("user_id", t.getUserId());
        out.put("type", t.getType());
        out.put("category", t.getCategory());
        out.put("amount", t.getAmount());
        out.put("description", t.getDescription());
        out.put("date", t.getDate());
        return out;
    }

    public static Map<String, Object> category(Category c) {
        Map<String, Object> out = base(c.getId(), c.getCreatedAt(), c.getUpdatedAt(), c.getDeletedAt());
        out.put("user_id", c.getUserId());
        out.put("name", c.getName());
        out.put("type", c.getType());
        out.put("icon", c.getIcon());
        out.put("color", c.getColor());
        out.put("description", c.getDescription());
        out.put("is_default", c.getIsDefault());
        out.put("usage_count", c.getUsageCount());
        return out;
    }

    public static Map<String, Object> budget(Budget b) {
        Map<String, Object> out = base(b.getId(), b.getCreatedAt(), b.getUpdatedAt(), b.getDeletedAt());
        out.put("user_id", b.getUserId());
        out.put("category", b.getCategory());
        out.put("amount", b.getAmount());
        out.put("period_month", b.getPeriodMonth());
        out.put("color", b.getColor());
        out.put("icon", b.getIcon());
        out.put("notes", b.getNotes());
        return out;
    }

    private static Map<String, Object> base(Long id, LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime deletedAt) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("created_at", createdAt);
        out.put("updated_at", updatedAt);
        out.put("deleted_at", deletedAt);
        return out;
    }

}
