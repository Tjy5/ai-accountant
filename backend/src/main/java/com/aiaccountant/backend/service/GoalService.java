package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Goal;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.GoalMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
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
public class GoalService {
    private static final String ACTIVE_KEY = "ACTIVE";
    private static final Set<String> STATUSES = Set.of("active", "paused", "completed");
    private static final Set<String> ICONS = Set.of(
        "plane",
        "home",
        "graduation-cap",
        "sparkles",
        "piggy-bank",
        "gift",
        "wallet",
        "target",
        "heart-handshake",
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

    private final GoalMapper goalMapper;

    public GoalService(GoalMapper goalMapper) {
        this.goalMapper = goalMapper;
    }

    public Map<String, Object> list(Long userId, MultiValueMap<String, String> query) {
        String status = parseStatus(firstQuery(query, "status"), true);
        String search = RequestValues.trimToNull(firstQuery(query, "search", "q", "keyword"));

        List<Map<String, Object>> rows = goalMapper.findActiveByUser(userId).stream()
            .filter(goal -> status == null || status.equals(goal.getStatus()))
            .filter(goal -> matchesSearch(goal, search))
            .map(this::goalRow)
            .sorted(goalComparator())
            .toList();

        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("status", status);
        filters.put("search", search);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("goals", rows);
        out.put("summary", summary(rows));
        out.put("filters", filters);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> create(Long userId, Map<String, Object> body) {
        Goal goal = normalizeGoal(userId, null, body, false);
        try {
            goalMapper.insert(goal);
        } catch (DuplicateKeyException ex) {
            throw duplicateGoalException();
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("goal", goalRow(goalMapper.findActiveByIdAndUser(goal.getId(), userId)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> update(Long userId, Long id, Map<String, Object> body) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "goal id is invalid");
        if (body == null || body.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "goal update is empty");

        Goal goal = goalMapper.findActiveByIdAndUser(id, userId);
        if (goal == null) throw new ApiException(HttpStatus.NOT_FOUND, "goal not found");

        normalizeGoal(userId, goal, body, true);
        goal.setUpdatedAt(LocalDateTime.now());
        try {
            goalMapper.updateById(goal);
        } catch (DuplicateKeyException ex) {
            throw duplicateGoalException();
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("goal", goalRow(goalMapper.findActiveByIdAndUser(id, userId)));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> delete(Long userId, Long id) {
        if (id == null || id <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "goal id is invalid");
        Goal goal = goalMapper.findActiveByIdAndUser(id, userId);
        if (goal == null) throw new ApiException(HttpStatus.NOT_FOUND, "goal not found");

        goalMapper.softDeleteByIdAndUser(id, userId, LocalDateTime.now());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("deleted", true);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    private Goal normalizeGoal(Long userId, Goal existing, Map<String, Object> body, boolean partial) {
        if (body == null) throw new ApiException(HttpStatus.BAD_REQUEST, "goal is invalid");
        Goal goal = existing == null ? new Goal() : existing;
        if (existing == null) {
            goal.setUserId(userId);
        }
        goal.setActiveKey(ACTIVE_KEY);

        if (!partial || hasAny(body, "title", "name")) {
            String title = RequestValues.trimToNull(RequestValues.first(body, "title", "name"));
            if (title == null) throw new ApiException(HttpStatus.BAD_REQUEST, "goal title is required");
            if (title.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "goal title is too long");
            goal.setTitle(title);
        }

        if (!partial || hasAny(body, "targetAmount", "target_amount", "amount")) {
            BigDecimal targetAmount = RequestValues.decimal(RequestValues.first(body, "targetAmount", "target_amount", "amount"));
            if (targetAmount == null || targetAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "target amount must be greater than 0");
            }
            goal.setTargetAmount(targetAmount);
        }

        if (!partial || hasAny(body, "savedAmount", "saved_amount", "currentAmount", "current_amount")) {
            BigDecimal savedAmount = RequestValues.decimal(RequestValues.first(body, "savedAmount", "saved_amount", "currentAmount", "current_amount"));
            if (savedAmount == null) savedAmount = BigDecimal.ZERO;
            if (savedAmount.compareTo(BigDecimal.ZERO) < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "saved amount cannot be negative");
            }
            goal.setSavedAmount(savedAmount);
        }

        if (!partial || hasAny(body, "targetDate", "target_date", "deadline")) {
            Object rawTargetDate = RequestValues.first(body, "targetDate", "target_date", "deadline");
            LocalDateTime targetDate = parseTargetDate(rawTargetDate);
            goal.setTargetDate(targetDate);
        }

        if (!partial || hasAny(body, "status")) {
            String status = parseStatus(RequestValues.trimToNull(RequestValues.first(body, "status")), false);
            goal.setStatus(status == null ? "active" : status);
        }

        if (!partial || hasAny(body, "icon")) {
            String icon = RequestValues.trimToNull(RequestValues.first(body, "icon"));
            goal.setIcon(icon == null || !ICONS.contains(icon) ? "target" : icon);
        }

        if (!partial || hasAny(body, "color")) {
            String color = RequestValues.trimToNull(RequestValues.first(body, "color"));
            goal.setColor(color == null || !COLORS.contains(color) ? "#FF8C94" : color);
        }

        if (!partial || hasAny(body, "notes", "description")) {
            String notes = RequestValues.trimToNull(RequestValues.first(body, "notes", "description"));
            if (notes != null && notes.length() > 500) throw new ApiException(HttpStatus.BAD_REQUEST, "goal notes are too long");
            goal.setNotes(notes);
        }

        if (goal.getSavedAmount() == null) goal.setSavedAmount(BigDecimal.ZERO);

        Goal duplicate = existing == null
            ? goalMapper.findActiveByTitle(userId, goal.getTitle())
            : goalMapper.findActiveByTitleExcludingId(userId, goal.getTitle(), existing.getId());
        if (duplicate != null) throw duplicateGoalException();

        return goal;
    }

    private Map<String, Object> goalRow(Goal goal) {
        BigDecimal targetAmount = goal.getTargetAmount() == null ? BigDecimal.ZERO : goal.getTargetAmount();
        BigDecimal savedAmount = goal.getSavedAmount() == null ? BigDecimal.ZERO : goal.getSavedAmount();
        BigDecimal remaining = targetAmount.subtract(savedAmount);
        if (remaining.compareTo(BigDecimal.ZERO) < 0) remaining = BigDecimal.ZERO;

        Map<String, Object> out = Rows.goal(goal);
        out.put("remaining", remaining);
        out.put("progress", percent(savedAmount, targetAmount));
        out.put("daysLeft", daysLeft(goal.getTargetDate()));
        out.put("pace", pace(goal, remaining));
        return out;
    }

    private Map<String, Object> summary(List<Map<String, Object>> rows) {
        BigDecimal totalTarget = BigDecimal.ZERO;
        BigDecimal totalSaved = BigDecimal.ZERO;
        int active = 0;
        int completed = 0;
        int dueSoon = 0;

        for (Map<String, Object> row : rows) {
            BigDecimal targetAmount = (BigDecimal) row.get("target_amount");
            BigDecimal savedAmount = (BigDecimal) row.get("saved_amount");
            totalTarget = totalTarget.add(targetAmount);
            totalSaved = totalSaved.add(savedAmount);
            if ("active".equals(row.get("status"))) active++;
            if ("completed".equals(row.get("status")) || percent(savedAmount, targetAmount) >= 100) completed++;
            Object daysLeftValue = row.get("daysLeft");
            if (daysLeftValue instanceof Long daysLeft && daysLeft >= 0 && daysLeft <= 30) dueSoon++;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalTarget", totalTarget);
        out.put("totalSaved", totalSaved);
        out.put("remaining", totalTarget.subtract(totalSaved).max(BigDecimal.ZERO));
        out.put("progress", percent(totalSaved, totalTarget));
        out.put("count", rows.size());
        out.put("active", active);
        out.put("completed", completed);
        out.put("dueSoon", dueSoon);
        return out;
    }

    private Comparator<Map<String, Object>> goalComparator() {
        return Comparator
            .comparing((Map<String, Object> row) -> !"active".equals(row.get("status")))
            .thenComparing(row -> {
                Object daysLeft = row.get("daysLeft");
                return daysLeft instanceof Long value ? value : Long.MAX_VALUE;
            })
            .thenComparing(row -> String.valueOf(row.get("title")).toLowerCase());
    }

    private String pace(Goal goal, BigDecimal remaining) {
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) return "complete";
        Long daysLeft = daysLeft(goal.getTargetDate());
        if (daysLeft == null) return "open";
        if (daysLeft < 0) return "overdue";
        if (daysLeft <= 30) return "due_soon";
        return "steady";
    }

    private int percent(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) <= 0) return 0;
        return numerator.multiply(BigDecimal.valueOf(100))
            .divide(denominator, 0, RoundingMode.HALF_UP)
            .intValue();
    }

    private Long daysLeft(LocalDateTime targetDate) {
        if (targetDate == null) return null;
        return ChronoUnit.DAYS.between(LocalDate.now(), targetDate.toLocalDate());
    }

    private LocalDateTime parseTargetDate(Object rawTargetDate) {
        String value = RequestValues.trimToNull(rawTargetDate);
        if (value == null) return null;
        try {
            return LocalDate.parse(value.substring(0, Math.min(10, value.length()))).atStartOfDay();
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "target date is invalid");
        }
    }

    private String parseStatus(String raw, boolean allowAll) {
        String value = RequestValues.trimToNull(raw);
        if (value == null || (allowAll && "all".equals(value))) return null;
        if (!STATUSES.contains(value)) throw new ApiException(HttpStatus.BAD_REQUEST, "goal status is invalid");
        return value;
    }

    private boolean matchesSearch(Goal goal, String search) {
        if (search == null) return true;
        String haystack = (goal.getTitle() + " " + goal.getStatus() + " " + String.valueOf(goal.getNotes())).toLowerCase();
        return haystack.contains(search.toLowerCase());
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

    private ApiException duplicateGoalException() {
        return new ApiException(HttpStatus.CONFLICT, "goal title already exists");
    }
}
