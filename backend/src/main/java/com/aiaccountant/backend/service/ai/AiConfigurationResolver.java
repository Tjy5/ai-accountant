package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.util.AiBaseUrlValidator;
import com.aiaccountant.backend.util.RequestValues;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AiConfigurationResolver {
    private final AppProperties properties;
    private final UserSettingsMapper settingsMapper;
    private final ApiKeyCipherService apiKeyCipherService;
    private final AiBaseUrlValidator baseUrlValidator;

    public AiConfigurationResolver(
        AppProperties properties,
        UserSettingsMapper settingsMapper,
        ApiKeyCipherService apiKeyCipherService,
        AiBaseUrlValidator baseUrlValidator
    ) {
        this.properties = properties;
        this.settingsMapper = settingsMapper;
        this.apiKeyCipherService = apiKeyCipherService;
        this.baseUrlValidator = baseUrlValidator;
    }

    public AiProviderConfig resolve(Long userId) {
        return resolveInternal(userId, Map.of(), false);
    }

    public AiProviderConfig resolveForTest(Long userId, Map<String, Object> overrides) {
        return resolveInternal(userId, overrides == null ? Map.of() : overrides, true);
    }

    private AiProviderConfig resolveInternal(Long userId, Map<String, Object> overrides, boolean allowTransientApiKey) {
        AppProperties.Ai ai = properties.getAi();
        UserSettings settings = settingsMapper.findActiveByUserId(userId);

        if (!ai.isEnabled()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI provider is disabled", "AI_PROVIDER_DISABLED");
        }
        if (settings != null && Boolean.FALSE.equals(settings.getAiAssistEnabled())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI assist is disabled for this account", "AI_PROVIDER_DISABLED");
        }

        String apiKey = null;
        if (allowTransientApiKey) {
            apiKey = RequestValues.trimToNull(RequestValues.first(overrides, "apiKey", "api_key"));
        }
        if (apiKey == null && settings != null && RequestValues.trimToNull(settings.getAiApiKeyEncrypted()) != null) {
            apiKey = apiKeyCipherService.decrypt(userId, settings.getAiApiKeyEncrypted());
        }
        if (apiKey == null) {
            apiKey = RequestValues.trimToNull(ai.getApiKey());
        }
        if (apiKey == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI provider is not configured", "AI_PROVIDER_NOT_CONFIGURED");
        }

        String baseUrl = RequestValues.trimToNull(RequestValues.first(overrides, "baseUrl", "base_url"));
        if (baseUrl == null && settings != null) baseUrl = RequestValues.trimToNull(settings.getAiBaseUrl());
        if (baseUrl == null) baseUrl = RequestValues.trimToNull(ai.getBaseUrl());
        if (baseUrl == null) throw new ApiException(HttpStatus.BAD_REQUEST, "AI Base URL is not configured", "INVALID_AI_BASE_URL");
        baseUrl = baseUrlValidator.normalize(baseUrl);

        String model = RequestValues.trimToNull(RequestValues.first(overrides, "model"));
        if (model == null && settings != null) model = RequestValues.trimToNull(settings.getAiModel());
        if (model == null) model = RequestValues.trimToNull(ai.getModel());
        if (model == null) throw new ApiException(HttpStatus.BAD_REQUEST, "AI model is not configured", "AI_MODEL_NOT_CONFIGURED");

        int timeoutSeconds = ai.getRequestTimeoutSeconds() <= 0 ? 25 : ai.getRequestTimeoutSeconds();
        int maxOutputTokens = ai.getMaxOutputTokens() <= 0 ? 1200 : ai.getMaxOutputTokens();
        BigDecimal temperature = ai.getTemperature() == null ? BigDecimal.ZERO : ai.getTemperature();

        return new AiProviderConfig(
            true,
            apiKey,
            baseUrl,
            model,
            Duration.ofSeconds(timeoutSeconds),
            maxOutputTokens,
            temperature
        );
    }
}
