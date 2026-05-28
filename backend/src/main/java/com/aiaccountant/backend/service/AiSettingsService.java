package com.aiaccountant.backend.service;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.User;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserMapper;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.service.ai.AiConfigurationResolver;
import com.aiaccountant.backend.service.ai.AiProviderClient;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiConnectionTestResult;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.service.ai.ApiKeyCipherService;
import com.aiaccountant.backend.util.AiBaseUrlValidator;
import com.aiaccountant.backend.util.RequestValues;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AiSettingsService {
    private final AppProperties properties;
    private final UserMapper userMapper;
    private final UserSettingsMapper settingsMapper;
    private final ApiKeyCipherService apiKeyCipherService;
    private final AiBaseUrlValidator baseUrlValidator;
    private final AiConfigurationResolver aiConfigurationResolver;
    private final AiProviderClient aiProviderClient;

    public AiSettingsService(
        AppProperties properties,
        UserMapper userMapper,
        UserSettingsMapper settingsMapper,
        ApiKeyCipherService apiKeyCipherService,
        AiBaseUrlValidator baseUrlValidator,
        AiConfigurationResolver aiConfigurationResolver,
        AiProviderClient aiProviderClient
    ) {
        this.properties = properties;
        this.userMapper = userMapper;
        this.settingsMapper = settingsMapper;
        this.apiKeyCipherService = apiKeyCipherService;
        this.baseUrlValidator = baseUrlValidator;
        this.aiConfigurationResolver = aiConfigurationResolver;
        this.aiProviderClient = aiProviderClient;
    }

    public Map<String, Object> get(Long userId) {
        requireUser(userId);
        UserSettings settings = ensureSettings(userId);
        Map<String, Object> out = row(settings);
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    @Transactional
    public Map<String, Object> update(Long userId, Map<String, Object> body) {
        requireUser(userId);
        if (body == null) body = Map.of();
        UserSettings settings = ensureSettings(userId);

        if (RequestValues.hasAny(body, "aiAssistEnabled", "ai_assist_enabled", "enabled")) {
            settings.setAiAssistEnabled(RequestValues.bool(RequestValues.first(body, "aiAssistEnabled", "ai_assist_enabled", "enabled")));
        }

        if (RequestValues.bool(RequestValues.first(body, "clearApiKey", "clear_api_key"))) {
            settings.setAiApiKeyEncrypted(null);
            settings.setAiApiKeyLast4(null);
        }

        String apiKey = RequestValues.trimToNull(RequestValues.first(body, "apiKey", "api_key"));
        if (apiKey != null) {
            settings.setAiApiKeyEncrypted(apiKeyCipherService.encrypt(userId, apiKey));
            settings.setAiApiKeyLast4(apiKeyCipherService.last4(apiKey));
        }

        if (RequestValues.hasAny(body, "baseUrl", "base_url")) {
            String baseUrl = RequestValues.trimToNull(RequestValues.first(body, "baseUrl", "base_url"));
            settings.setAiBaseUrl(baseUrl == null ? null : baseUrlValidator.normalize(baseUrl));
        }

        if (RequestValues.hasAny(body, "model")) {
            settings.setAiModel(RequestValues.trimToNull(RequestValues.first(body, "model")));
        }

        settings.setUpdatedAt(LocalDateTime.now());
        settingsMapper.updateById(settings);

        Map<String, Object> out = row(settingsMapper.findActiveByUserId(userId));
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }

    public Map<String, Object> test(Long userId, Map<String, Object> body) {
        requireUser(userId);
        AiProviderConfig config = aiConfigurationResolver.resolveForTest(userId, body == null ? Map.of() : body);
        AiConnectionTestResult result = aiProviderClient.test(config);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", result.ok());
        out.put("message", result.message());
        out.put("model", result.model());
        out.put("baseUrl", result.baseUrl());
        out.put("latencyMs", result.latencyMs());
        out.put("timestamp", System.currentTimeMillis());
        return out;
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

    private Map<String, Object> row(UserSettings settings) {
        AppProperties.Ai ai = properties.getAi();
        boolean userKey = RequestValues.trimToNull(settings.getAiApiKeyEncrypted()) != null;
        boolean systemKey = RequestValues.trimToNull(ai.getApiKey()) != null;
        String userBaseUrl = RequestValues.trimToNull(settings.getAiBaseUrl());
        String userModel = RequestValues.trimToNull(settings.getAiModel());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("aiAssistEnabled", settings.getAiAssistEnabled());
        out.put("apiKeyConfigured", userKey || systemKey);
        out.put("apiKeyPreview", userKey ? "****" + settings.getAiApiKeyLast4() : null);
        out.put("usesUserApiKey", userKey);
        out.put("usesSystemFallback", !userKey && systemKey);
        out.put("baseUrl", userBaseUrl);
        out.put("model", userModel);
        out.put("effectiveBaseUrl", userBaseUrl != null ? userBaseUrl : ai.getBaseUrl());
        out.put("effectiveModel", userModel != null ? userModel : ai.getModel());
        out.put("encryptionConfigured", apiKeyCipherService.canEncrypt());
        return out;
    }
}
