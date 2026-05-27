package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.User;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserMapper;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.util.RequestValues;
import com.aiaccountant.backend.util.Rows;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {
    private static final Set<String> CURRENCIES = Set.of("USD", "CNY", "EUR", "JPY", "GBP", "HKD");

    private final UserMapper userMapper;
    private final UserSettingsMapper settingsMapper;

    public SettingsService(UserMapper userMapper, UserSettingsMapper settingsMapper) {
        this.userMapper = userMapper;
        this.settingsMapper = settingsMapper;
    }

    @Transactional
    public Map<String, Object> get(Long userId) {
        User user = requireUser(userId);
        UserSettings settings = ensureSettings(userId);
        return response(user, settings);
    }

    @Transactional
    public Map<String, Object> update(Long userId, Map<String, Object> body) {
        if (body == null || body.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "settings update is empty");

        User user = requireUser(userId);
        UserSettings settings = ensureSettings(userId);
        LocalDateTime now = LocalDateTime.now();

        if (hasAny(body, "name", "displayName")) {
            String name = RequestValues.trimToNull(RequestValues.first(body, "displayName", "name"));
            if (name != null && name.length() > 80) throw new ApiException(HttpStatus.BAD_REQUEST, "display name is too long");
            userMapper.updateName(userId, name, now);
            user.setName(name);
        }

        if (hasAny(body, "defaultCurrency", "default_currency", "currency")) {
            String currency = RequestValues.trimToNull(RequestValues.first(body, "defaultCurrency", "default_currency", "currency"));
            currency = currency == null ? null : currency.toUpperCase();
            if (currency == null || !CURRENCIES.contains(currency)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "currency is not supported");
            }
            settings.setDefaultCurrency(currency);
        }

        if (hasAny(body, "monthStartDay", "month_start_day")) {
            Integer day = RequestValues.integer(RequestValues.first(body, "monthStartDay", "month_start_day"));
            if (day == null || day < 1 || day > 28) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "month start day must be between 1 and 28");
            }
            settings.setMonthStartDay(day);
        }

        if (hasAny(body, "receiptReminders", "receipt_reminders")) {
            settings.setReceiptReminders(RequestValues.bool(RequestValues.first(body, "receiptReminders", "receipt_reminders")));
        }
        if (hasAny(body, "budgetAlerts", "budget_alerts")) {
            settings.setBudgetAlerts(RequestValues.bool(RequestValues.first(body, "budgetAlerts", "budget_alerts")));
        }
        if (hasAny(body, "weeklyReport", "weekly_report")) {
            settings.setWeeklyReport(RequestValues.bool(RequestValues.first(body, "weeklyReport", "weekly_report")));
        }
        if (hasAny(body, "aiAssistEnabled", "ai_assist_enabled")) {
            settings.setAiAssistEnabled(RequestValues.bool(RequestValues.first(body, "aiAssistEnabled", "ai_assist_enabled")));
        }

        settings.setUpdatedAt(now);
        settingsMapper.updateById(settings);

        return response(user, settingsMapper.findActiveByUserId(userId));
    }

    private User requireUser(Long userId) {
        User user = userMapper.findActiveById(userId);
        if (user == null) throw new ApiException(HttpStatus.NOT_FOUND, "用户不存在");
        return user;
    }

    private UserSettings ensureSettings(Long userId) {
        UserSettings existing = settingsMapper.findActiveByUserId(userId);
        if (existing != null) return existing;

        UserSettings settings = new UserSettings();
        settings.setUserId(userId);
        settings.setDefaultCurrency("USD");
        settings.setMonthStartDay(1);
        settings.setReceiptReminders(true);
        settings.setBudgetAlerts(true);
        settings.setWeeklyReport(false);
        settings.setAiAssistEnabled(true);
        settingsMapper.insert(settings);
        return settingsMapper.findActiveByUserId(userId);
    }

    private Map<String, Object> response(User user, UserSettings settings) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", Rows.user(user));
        out.put("settings", Rows.settings(settings));
        out.put("options", Map.of(
            "currencies", List.of("USD", "CNY", "EUR", "JPY", "GBP", "HKD"),
            "monthStartDays", Stream.iterate(1, day -> day + 1).limit(28).toList()
        ));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    private boolean hasAny(Map<String, Object> body, String... keys) {
        if (body == null) return false;
        return Stream.of(keys).anyMatch(body::containsKey);
    }
}
