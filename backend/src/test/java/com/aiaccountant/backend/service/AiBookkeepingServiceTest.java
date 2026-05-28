package com.aiaccountant.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.service.ai.AiConfigurationResolver;
import com.aiaccountant.backend.service.ai.AiJsonMode;
import com.aiaccountant.backend.service.ai.AiProviderClient;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionResult;
import com.aiaccountant.backend.service.ai.AiRecognitionNormalizer;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AiBookkeepingServiceTest {
    @Test
    void analyzeUsesUserDefaultCurrencyInProviderRequest() {
        AppProperties properties = new AppProperties();
        CategoryService categoryService = mock(CategoryService.class);
        AiConfigurationResolver resolver = mock(AiConfigurationResolver.class);
        AiProviderClient providerClient = mock(AiProviderClient.class);
        AiRecognitionNormalizer normalizer = mock(AiRecognitionNormalizer.class);
        TransactionService transactionService = mock(TransactionService.class);
        UserSettingsMapper settingsMapper = mock(UserSettingsMapper.class);

        UserSettings settings = new UserSettings();
        settings.setDefaultCurrency("CNY");

        when(categoryService.listInternal(7L)).thenReturn(List.of());
        when(settingsMapper.findActiveByUserId(7L)).thenReturn(settings);
        when(resolver.resolve(7L)).thenReturn(new AiProviderConfig(
            7L,
            true,
            "user-key",
            "https://api.openai.com/v1",
            "gpt-test",
            Duration.ofSeconds(5),
            1200,
            BigDecimal.ZERO,
            AiJsonMode.JSON_SCHEMA_STRICT
        ));

        AiRecognitionResult rawResult = new AiRecognitionResult(
            "ok",
            "bookkeeping",
            List.of(),
            false,
            null,
            List.of(),
            List.of(),
            null
        );
        when(providerClient.recognizeText(any(), any())).thenReturn(rawResult);
        when(normalizer.normalize(eq(7L), eq(rawResult))).thenReturn(rawResult);

        AiBookkeepingService service = new AiBookkeepingService(
            properties,
            categoryService,
            resolver,
            providerClient,
            normalizer,
            transactionService,
            settingsMapper
        );

        service.analyze(7L, Map.of("text", "午餐 12"));

        ArgumentCaptor<AiRecognitionRequest> requestCaptor = ArgumentCaptor.forClass(AiRecognitionRequest.class);
        verify(providerClient).recognizeText(any(), requestCaptor.capture());
        assertEquals("CNY", requestCaptor.getValue().defaultCurrency());
    }

    @Test
    void analyzeWithUserProviderConfigDoesNotRequireSystemApiKey() {
        AppProperties properties = new AppProperties();
        properties.getAi().setApiKey("");
        CategoryService categoryService = mock(CategoryService.class);
        AiConfigurationResolver resolver = mock(AiConfigurationResolver.class);
        AiProviderClient providerClient = mock(AiProviderClient.class);
        AiRecognitionNormalizer normalizer = mock(AiRecognitionNormalizer.class);
        TransactionService transactionService = mock(TransactionService.class);
        UserSettingsMapper settingsMapper = mock(UserSettingsMapper.class);

        UserSettings settings = new UserSettings();
        settings.setDefaultCurrency("USD");

        AiProviderConfig userConfig = new AiProviderConfig(
            7L,
            true,
            "user-key",
            "https://api.openai.com/v1",
            "gpt-test",
            Duration.ofSeconds(5),
            1200,
            BigDecimal.ZERO,
            AiJsonMode.JSON_SCHEMA_STRICT
        );
        AiRecognitionResult rawResult = new AiRecognitionResult(
            "ok",
            "bookkeeping",
            List.of(),
            false,
            null,
            List.of(),
            List.of(),
            null
        );

        when(categoryService.listInternal(7L)).thenReturn(List.of());
        when(settingsMapper.findActiveByUserId(7L)).thenReturn(settings);
        when(resolver.resolve(7L)).thenReturn(userConfig);
        when(providerClient.recognizeText(eq(userConfig), any())).thenReturn(rawResult);
        when(normalizer.normalize(eq(7L), eq(rawResult))).thenReturn(rawResult);

        AiBookkeepingService service = new AiBookkeepingService(
            properties,
            categoryService,
            resolver,
            providerClient,
            normalizer,
            transactionService,
            settingsMapper
        );

        service.analyze(7L, Map.of("text", "午餐 12"));

        verify(resolver).resolve(7L);
        verify(providerClient).recognizeText(eq(userConfig), any());
    }
}
