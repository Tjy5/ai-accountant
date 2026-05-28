package com.aiaccountant.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.User;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserMapper;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.service.ai.AiConfigurationResolver;
import com.aiaccountant.backend.service.ai.AiProviderClient;
import com.aiaccountant.backend.service.ai.ApiKeyCipherService;
import com.aiaccountant.backend.util.AiBaseUrlValidator;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiSettingsServiceTest {
    @Test
    void updateCanSavePersonalKeyWhenEncryptionIsNotConfigured() {
        Fixture fixture = fixture();
        fixture.properties.getAi().setEncryptionKey("");

        Map<String, Object> out = fixture.service.update(1L, Map.of("apiKey", "plain-key-1234"));

        assertEquals("****1234", out.get("apiKeyPreview"));
        assertEquals(true, out.get("usesUserApiKey"));
        assertEquals(false, out.get("encryptionConfigured"));
        verify(fixture.settingsMapper).updateById(fixture.settings);
    }

    @Test
    void updateClearsSavedApiKey() {
        Fixture fixture = fixture();
        fixture.settings.setAiApiKeyEncrypted("plain:c2VjcmV0");
        fixture.settings.setAiApiKeyLast4("cret");

        fixture.service.update(1L, Map.of("clearApiKey", true));

        assertNull(fixture.settings.getAiApiKeyEncrypted());
        assertNull(fixture.settings.getAiApiKeyLast4());
        verify(fixture.settingsMapper).updateById(fixture.settings);
    }

    @Test
    void invalidBaseUrlThrowsControlledCode() {
        Fixture fixture = fixture();

        ApiException ex = assertThrows(ApiException.class, () -> fixture.service.update(1L, Map.of("baseUrl", "http://localhost:9999")));

        assertEquals("INVALID_AI_BASE_URL", ex.getCode());
    }

    private Fixture fixture() {
        AppProperties properties = new AppProperties();
        properties.getAi().setBaseUrlAllowlist("api.openai.com");
        UserMapper userMapper = mock(UserMapper.class);
        UserSettingsMapper settingsMapper = mock(UserSettingsMapper.class);
        UserSettings settings = new UserSettings();
        settings.setUserId(1L);
        settings.setAiAssistEnabled(true);
        settings.setDefaultCurrency("USD");

        User user = new User();
        user.setId(1L);
        when(userMapper.findActiveById(1L)).thenReturn(user);
        when(settingsMapper.findActiveByUserId(1L)).thenReturn(settings);
        when(settingsMapper.updateById(any(UserSettings.class))).thenReturn(1);

        ApiKeyCipherService cipher = new ApiKeyCipherService(properties);
        AiSettingsService service = new AiSettingsService(
            properties,
            userMapper,
            settingsMapper,
            cipher,
            new AiBaseUrlValidator(properties),
            mock(AiConfigurationResolver.class),
            mock(AiProviderClient.class)
        );
        return new Fixture(properties, settingsMapper, settings, service);
    }

    private record Fixture(
        AppProperties properties,
        UserSettingsMapper settingsMapper,
        UserSettings settings,
        AiSettingsService service
    ) {
    }
}
