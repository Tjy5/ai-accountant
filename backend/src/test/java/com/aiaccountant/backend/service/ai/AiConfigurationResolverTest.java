package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.util.AiBaseUrlValidator;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiConfigurationResolverTest {
    @Test
    void userKeyOverridesSystemKey() {
        AppProperties properties = properties();
        properties.getAi().setApiKey("system-key");
        ApiKeyCipherService cipher = mock(ApiKeyCipherService.class);
        UserSettingsMapper settingsMapper = mock(UserSettingsMapper.class);
        UserSettings settings = settings("encrypted-user-key");
        when(settingsMapper.findActiveByUserId(1L)).thenReturn(settings);
        when(cipher.decrypt(1L, "encrypted-user-key")).thenReturn("user-key");

        AiProviderConfig config = resolver(properties, settingsMapper, cipher).resolve(1L);

        assertEquals("user-key", config.apiKey());
    }

    @Test
    void transientTestOverrideBeatsSavedUserKey() {
        AppProperties properties = properties();
        ApiKeyCipherService cipher = mock(ApiKeyCipherService.class);
        UserSettingsMapper settingsMapper = mock(UserSettingsMapper.class);
        when(settingsMapper.findActiveByUserId(1L)).thenReturn(settings("encrypted-user-key"));

        AiProviderConfig config = resolver(properties, settingsMapper, cipher).resolveForTest(1L, Map.of("apiKey", "override-key"));

        assertEquals("override-key", config.apiKey());
    }

    @Test
    void disabledProviderThrowsControlledCode() {
        AppProperties properties = properties();
        properties.getAi().setEnabled(false);

        ApiException ex = assertThrows(ApiException.class, () -> resolver(properties).resolve(1L));

        assertEquals("AI_PROVIDER_DISABLED", ex.getCode());
    }

    @Test
    void disabledUserAssistThrowsControlledCode() {
        UserSettingsMapper settingsMapper = mock(UserSettingsMapper.class);
        UserSettings settings = settings(null);
        settings.setAiAssistEnabled(false);
        when(settingsMapper.findActiveByUserId(1L)).thenReturn(settings);

        ApiException ex = assertThrows(ApiException.class, () -> resolver(properties(), settingsMapper, mock(ApiKeyCipherService.class)).resolve(1L));

        assertEquals("AI_PROVIDER_DISABLED", ex.getCode());
    }

    @Test
    void missingKeysThrowNotConfigured() {
        AppProperties properties = properties();
        properties.getAi().setApiKey("");

        ApiException ex = assertThrows(ApiException.class, () -> resolver(properties).resolve(1L));

        assertEquals("AI_PROVIDER_NOT_CONFIGURED", ex.getCode());
    }

    private AiConfigurationResolver resolver(AppProperties properties) {
        return resolver(properties, mock(UserSettingsMapper.class), mock(ApiKeyCipherService.class));
    }

    private AiConfigurationResolver resolver(
        AppProperties properties,
        UserSettingsMapper settingsMapper,
        ApiKeyCipherService cipher
    ) {
        return new AiConfigurationResolver(properties, settingsMapper, cipher, new AiBaseUrlValidator(properties));
    }

    private AppProperties properties() {
        AppProperties properties = new AppProperties();
        properties.getAi().setApiKey("system-key");
        properties.getAi().setBaseUrl("https://api.openai.com/v1");
        properties.getAi().setBaseUrlAllowlist("api.openai.com");
        properties.getAi().setModel("gpt-test");
        return properties;
    }

    private UserSettings settings(String encryptedKey) {
        UserSettings settings = new UserSettings();
        settings.setAiAssistEnabled(true);
        settings.setAiApiKeyEncrypted(encryptedKey);
        settings.setAiBaseUrl("https://api.openai.com/v1");
        settings.setAiModel("gpt-user");
        return settings;
    }
}
