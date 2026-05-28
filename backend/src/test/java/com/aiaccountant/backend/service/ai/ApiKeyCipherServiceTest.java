package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.exception.ApiException;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class ApiKeyCipherServiceTest {
    @Test
    void encryptDecryptRoundTripUsesUserScopedAad() {
        ApiKeyCipherService service = new ApiKeyCipherService(propertiesWithKey());

        String encrypted = service.encrypt(1L, "secret-api-key");

        assertTrue(service.canEncrypt());
        assertEquals("secret-api-key", service.decrypt(1L, encrypted));

        ApiException wrongUser = assertThrows(ApiException.class, () -> service.decrypt(2L, encrypted));
        assertEquals("AI_CONFIG_DECRYPTION_FAILED", wrongUser.getCode());
    }

    @Test
    void missingEncryptionKeyFallsBackToLocalPlainValue() {
        ApiKeyCipherService service = new ApiKeyCipherService(new AppProperties());

        String stored = service.encrypt(1L, "plain-key");

        assertFalse(service.canEncrypt());
        assertTrue(stored.startsWith("plain:"));
        assertEquals("plain-key", service.decrypt(99L, stored));
    }

    @Test
    void damagedCiphertextThrowsControlledCode() {
        ApiKeyCipherService service = new ApiKeyCipherService(propertiesWithKey());

        ApiException ex = assertThrows(ApiException.class, () -> service.decrypt(1L, "v1:not-base64:not-base64"));

        assertEquals("AI_CONFIG_DECRYPTION_FAILED", ex.getCode());
    }

    private AppProperties propertiesWithKey() {
        AppProperties properties = new AppProperties();
        properties.getAi().setEncryptionKey(Base64.getEncoder().encodeToString("0123456789abcdef".getBytes()));
        return properties;
    }
}
