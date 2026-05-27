package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Category;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.CategoryMapper;
import com.aiaccountant.backend.mapper.TransactionMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.MultiValueMap;

@Service
public class CategoryService {
    private static final Set<String> VALID_TYPES = Set.of("income", "expense", "both");
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

    private final CategoryMapper categoryMapper;
    private final TransactionMapper transactionMapper;

    public CategoryService(CategoryMapper categoryMapper, TransactionMapper transactionMapper) {
        this.categoryMapper = categoryMapper;
        this.transactionMapper = transactionMapper;
    }

    public Map<String, Object> list(Long userId, MultiValueMap<String, String> query) {
        seedDefaultCategoriesForUser(userId);
        QueryFilters filters = parseFilters(query);
        Map<String, CategoryUsage> usage = categoryUsage(userId);
        List<Map<String, Object>> categories = categoryMapper.findActiveByUser(userId).stream()
            .filter(category -> filters.type() == null || "both".equals(category.getType()) || filters.type().equals(category.getType()))
            .filter(category -> {
                if (filters.search() == null) return true;
                String haystack = String.join(" ",
                    category.getName() == null ? "" : category.getName(),
                    category.getDescription() == null ? "" : category.getDescription(),
                    category.getType() == null ? "" : category.getType()
                ).toLowerCase();
                return haystack.contains(filters.search().toLowerCase());
            })
            .sorted(Comparator
                .comparing((Category c) -> typeRank(c.getType()))
                .thenComparing(Category::getName, String.CASE_INSENSITIVE_ORDER))
            .map(category -> categoryRow(category, usage.get(category.getName())))
            .toList();

        long expense = categories.stream().filter(c -> "expense".equals(c.get("type"))).count();
        long income = categories.stream().filter(c -> "income".equals(c.get("type"))).count();
        long both = categories.stream().filter(c -> "both".equals(c.get("type"))).count();
        long defaultCount = categories.stream().filter(c -> Boolean.TRUE.equals(c.get("is_default"))).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", categories.size());
        stats.put("expense", expense);
        stats.put("income", income);
        stats.put("both", both);
        stats.put("custom", categories.size() - defaultCount);
        stats.put("default", defaultCount);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("categories", categories);
        out.put("stats", stats);
        out.put("filters", Map.of(
            "type", filters.type() == null ? "all" : filters.type(),
            "search", filters.search() == null ? "" : filters.search()
        ));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    public List<Category> listInternal(Long userId) {
        seedDefaultCategoriesForUser(userId);
        return categoryMapper.findActiveByUser(userId);
    }

    public String resolveCategoryName(Long userId, String requested, String transactionType) {
        List<Category> categories = listInternal(userId);
        String normalized = requested == null ? null : requested.trim();
        if (normalized != null && !normalized.isEmpty()) {
            for (Category category : categories) {
                if (normalized.equals(category.getName()) && supportsType(category, transactionType)) return category.getName();
            }
        }
        return categories.stream()
            .filter(c -> "其他".equals(c.getName()))
            .filter(c -> supportsType(c, transactionType))
            .findFirst()
            .or(() -> categories.stream().filter(c -> supportsType(c, transactionType)).findFirst())
            .or(() -> categories.stream().findFirst())
            .map(Category::getName)
            .orElse("其他");
    }

    @Transactional
    public Map<String, Object> create(Long userId, Map<String, Object> body) {
        seedDefaultCategoriesForUser(userId);
        Category category = normalizeCategory(userId, null, body, false);
        categoryMapper.insert(category);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("category", Rows.category(categoryMapper.findActiveByIdAndUser(category.getId(), userId)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> update(Long userId, Long id, Map<String, Object> body) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "category id is invalid");
        if (body == null || body.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "category update is empty");

        Category category = categoryMapper.findActiveByIdAndUser(id, userId);
        if (category == null) throw new ApiException(HttpStatus.NOT_FOUND, "category not found");

        normalizeCategory(userId, category, body, true);
        category.setUpdatedAt(LocalDateTime.now());
        categoryMapper.updateById(category);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("category", Rows.category(categoryMapper.findActiveByIdAndUser(id, userId)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> delete(Long userId, Long id) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "category id is invalid");
        Category category = categoryMapper.findActiveByIdAndUser(id, userId);
        if (category == null) throw new ApiException(HttpStatus.NOT_FOUND, "category not found");
        if (Boolean.TRUE.equals(category.getIsDefault())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "default categories cannot be deleted");
        }

        LocalDateTime now = LocalDateTime.now();
        categoryMapper.softDeleteByIdAndUser(id, userId, now);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("deleted", true);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public void seedDefaultCategoriesForUser(Long userId) {
        if (categoryMapper.countActiveByUser(userId) > 0) return;
        List<DefaultCategory> defaults = List.of(
            new DefaultCategory("餐饮", "expense", "utensils", "#FF8C94", "日常餐饮消费"),
            new DefaultCategory("交通", "expense", "bus", "#64B5F6", "公共交通、打车等"),
            new DefaultCategory("购物", "expense", "shopping-bag", "#FFD54F", "日常用品购买"),
            new DefaultCategory("工资", "income", "briefcase", "#7ACB9C", "工资收入"),
            new DefaultCategory("奖金", "income", "gift", "#FFB87A", "奖金、红包等"),
            new DefaultCategory("其他", "both", "more-horizontal", "#A1887F", "其他收入或支出")
        );
        for (DefaultCategory d : defaults) {
            if (categoryMapper.findActiveByName(userId, d.name()) != null) continue;
            Category c = new Category();
            c.setUserId(userId);
            c.setName(d.name());
            c.setType(d.type());
            c.setIcon(d.icon());
            c.setColor(d.color());
            c.setDescription(d.description());
            c.setIsDefault(true);
            c.setUsageCount(0);
            categoryMapper.insert(c);
        }
    }

    private boolean supportsType(Category category, String transactionType) {
        return "both".equals(category.getType()) || category.getType() == null || category.getType().equals(transactionType);
    }

    private Category normalizeCategory(Long userId, Category existing, Map<String, Object> body, boolean partial) {
        if (body == null) throw new ApiException(HttpStatus.BAD_REQUEST, "category is invalid");
        Category category = existing == null ? new Category() : existing;
        if (existing == null) {
            category.setUserId(userId);
            category.setIsDefault(false);
            category.setUsageCount(0);
        }

        if (existing != null && Boolean.TRUE.equals(existing.getIsDefault())) {
            String requestedName = RequestValues.trimToNull(RequestValues.first(body, "name"));
            String requestedType = RequestValues.trimToNull(RequestValues.first(body, "type"));
            if (requestedName != null && !requestedName.equals(existing.getName())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "default category names cannot be changed");
            }
            if (requestedType != null && !requestedType.equals(existing.getType())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "default category types cannot be changed");
            }
        }

        if (!partial || hasAny(body, "name")) {
            String name = RequestValues.trimToNull(RequestValues.first(body, "name"));
            if (name == null) throw new ApiException(HttpStatus.BAD_REQUEST, "category name is required");
            if (name.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "category name is too long");
            Category duplicate = existing == null
                ? categoryMapper.findActiveByName(userId, name)
                : categoryMapper.findActiveByNameExcludingId(userId, name, existing.getId());
            if (duplicate != null) throw new ApiException(HttpStatus.CONFLICT, "category name already exists");
            category.setName(name);
        }

        if (!partial || hasAny(body, "type")) {
            String type = RequestValues.trimToNull(RequestValues.first(body, "type"));
            if (type == null || !VALID_TYPES.contains(type)) throw new ApiException(HttpStatus.BAD_REQUEST, "invalid category type");
            category.setType(type);
        }

        if (!partial || hasAny(body, "icon")) {
            String icon = RequestValues.trimToNull(RequestValues.first(body, "icon"));
            category.setIcon(icon == null || !ICONS.contains(icon) ? "tag" : icon);
        }

        if (!partial || hasAny(body, "color")) {
            String color = RequestValues.trimToNull(RequestValues.first(body, "color"));
            category.setColor(color == null || !COLORS.contains(color) ? "#FF8C94" : color);
        }

        if (!partial || hasAny(body, "description")) {
            String description = RequestValues.trimToNull(RequestValues.first(body, "description"));
            if (description != null && description.length() > 500) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "category description is too long");
            }
            category.setDescription(description);
        }

        return category;
    }

    private Map<String, CategoryUsage> categoryUsage(Long userId) {
        Map<String, CategoryUsage> usage = new LinkedHashMap<>();
        for (Map<String, Object> row : transactionMapper.categoryStatsByUser(userId)) {
            String category = stringValue(row, "category", "CATEGORY");
            if (category == null) continue;
            String type = stringValue(row, "type", "TYPE");
            long count = longValue(row, "transaction_count", "TRANSACTION_COUNT", "transactionCount");
            BigDecimal amount = decimalValue(row, "total_amount", "TOTAL_AMOUNT", "totalAmount");
            CategoryUsage current = usage.computeIfAbsent(category, ignored -> new CategoryUsage());
            current.count += count;
            current.total = current.total.add(amount);
            if ("income".equals(type)) {
                current.income = current.income.add(amount);
            } else if ("expense".equals(type)) {
                current.expense = current.expense.add(amount);
            }
        }
        return usage;
    }

    private Map<String, Object> categoryRow(Category category, CategoryUsage usage) {
        Map<String, Object> out = Rows.category(category);
        CategoryUsage actual = usage == null ? new CategoryUsage() : usage;
        out.put("transaction_count", actual.count);
        out.put("income_total", actual.income);
        out.put("expense_total", actual.expense);
        out.put("total_amount", actual.total);
        return out;
    }

    private QueryFilters parseFilters(MultiValueMap<String, String> query) {
        String type = trimQuery(query, "type");
        if (type != null && !"all".equalsIgnoreCase(type)) {
            if (!VALID_TYPES.contains(type)) throw new ApiException(HttpStatus.BAD_REQUEST, "invalid category type");
        } else {
            type = null;
        }
        return new QueryFilters(type, trimQuery(query, "search", "q", "keyword"));
    }

    private String trimQuery(MultiValueMap<String, String> query, String... keys) {
        if (query == null) return null;
        for (String key : keys) {
            String value = RequestValues.trimToNull(query.getFirst(key));
            if (value != null) return value;
        }
        return null;
    }

    private boolean hasAny(Map<String, Object> body, String... keys) {
        if (body == null) return false;
        return Stream.of(keys).anyMatch(body::containsKey);
    }

    private int typeRank(String type) {
        if ("expense".equals(type)) return 0;
        if ("income".equals(type)) return 1;
        return 2;
    }

    private String stringValue(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value != null) return String.valueOf(value);
        }
        return null;
    }

    private long longValue(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value == null) continue;
            try {
                return Long.parseLong(String.valueOf(value));
            } catch (NumberFormatException ignored) {
            }
        }
        return 0L;
    }

    private BigDecimal decimalValue(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value == null) continue;
            try {
                return new BigDecimal(String.valueOf(value));
            } catch (NumberFormatException ignored) {
            }
        }
        return BigDecimal.ZERO;
    }

    private static class CategoryUsage {
        private long count;
        private BigDecimal income = BigDecimal.ZERO;
        private BigDecimal expense = BigDecimal.ZERO;
        private BigDecimal total = BigDecimal.ZERO;
    }

    private record QueryFilters(String type, String search) {
    }

    private record DefaultCategory(String name, String type, String icon, String color, String description) {
    }
}
