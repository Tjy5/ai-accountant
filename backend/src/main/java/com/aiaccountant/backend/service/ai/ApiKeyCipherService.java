package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.util.RequestValues;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ApiKeyCipherService {
    private static final String PREFIX = "v1";
    private static final String PLAIN_PREFIX = "plain";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final AppProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public ApiKeyCipherService(AppProperties properties) {
        this.properties = properties;
    }

    public boolean canEncrypt() {
        try {
            keyBytes();
            return true;
        } catch (ApiException ex) {
            return false;
        }
    }

    public String encrypt(Long userId, String apiKey) {
        String raw = RequestValues.trimToNull(apiKey);
        if (raw == null) throw new ApiException(HttpStatus.BAD_REQUEST, "AI API key is required");
        if (!canEncrypt()) {
            return PLAIN_PREFIX + ":" + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes(), "AES"), new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(userId));
            byte[] encrypted = cipher.doFinal(raw.getBytes(StandardCharsets.UTF_8));

            return PREFIX + ":" + Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(encrypted);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not encrypt AI API key", "AI_CONFIG_ENCRYPTION_FAILED");
        }
    }

    public String decrypt(Long userId, String encryptedValue) {
        String encrypted = RequestValues.trimToNull(encryptedValue);
        if (encrypted == null) return null;
        try {
            if (encrypted.startsWith(PLAIN_PREFIX + ":")) {
                return new String(Base64.getDecoder().decode(encrypted.substring(PLAIN_PREFIX.length() + 1)), StandardCharsets.UTF_8);
            }

            String[] parts = encrypted.split(":", 3);
            if (parts.length != 3 || !PREFIX.equals(parts[0])) {
                throw new IllegalArgumentException("unsupported key format");
            }

            byte[] iv = Base64.getDecoder().decode(parts[1]);
            byte[] payload = Base64.getDecoder().decode(parts[2]);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes(), "AES"), new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(userId));
            return new String(cipher.doFinal(payload), StandardCharsets.UTF_8);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not decrypt AI API key", "AI_CONFIG_DECRYPTION_FAILED");
        }
    }

    public String last4(String apiKey) {
        String raw = RequestValues.trimToNull(apiKey);
        if (raw == null) return null;
        return raw.length() <= 4 ? raw : raw.substring(raw.length() - 4);
    }

    private byte[] keyBytes() {
        String raw = RequestValues.trimToNull(properties.getAi().getEncryptionKey());
        if (raw == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI API key encryption is not configured", "AI_CONFIG_ENCRYPTION_NOT_CONFIGURED");
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(raw);
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "AI encryption key must be base64 encoded AES-128/192/256 material", "AI_CONFIG_ENCRYPTION_INVALID");
    }

    private byte[] aad(Long userId) {
        return ("user-settings-api-key:" + userId).getBytes(StandardCharsets.UTF_8);
    }
}
