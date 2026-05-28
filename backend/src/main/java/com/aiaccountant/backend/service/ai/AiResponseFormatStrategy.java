package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.config.AppProperties;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Decides which JSON response shape the AI provider should use.
 *
 * <p>Resolution order: per-model override (exact, then prefix) → global {@code app.ai.json-mode}
 * → auto heuristic based on model/baseUrl. Transient overrides (typically from the connection
 * test API) take precedence over all of the above.
 */
@Component
public class AiResponseFormatStrategy {
    private static final Logger log = LoggerFactory.getLogger(AiResponseFormatStrategy.class);
    private static final String AUTO = "auto";

    private final AppProperties appProperties;

    public AiResponseFormatStrategy(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    public AiJsonMode resolve(String baseUrl, String model) {
        return resolve(baseUrl, model, null);
    }

    public AiJsonMode resolve(String baseUrl, String model, String override) {
        Optional<AiJsonMode> overrideMode = parseMode(override, "transient override");
        if (overrideMode.isPresent()) return overrideMode.get();

        Optional<AiJsonMode> mapped = mappedMode(model);
        if (mapped.isPresent()) return mapped.get();

        String configured = trimToNull(appProperties.getAi().getJsonMode());
        if (configured != null && !AUTO.equalsIgnoreCase(configured)) {
            Optional<AiJsonMode> parsed = parseMode(configured, "app.ai.json-mode");
            if (parsed.isPresent()) return parsed.get();
        }

        return autoMode(baseUrl, model);
    }

    private Optional<AiJsonMode> mappedMode(String model) {
        String normalizedModel = normalize(model);
        if (normalizedModel == null) return Optional.empty();

        Map<String, String> mappings = appProperties.getAi().getModelJsonModes();
        if (mappings == null || mappings.isEmpty()) return Optional.empty();

        Optional<AiJsonMode> exact = findMapping(mappings, normalizedModel, true);
        if (exact.isPresent()) return exact;
        return findMapping(mappings, normalizedModel, false);
    }

    private Optional<AiJsonMode> findMapping(Map<String, String> mappings, String normalizedModel, boolean exact) {
        for (Map.Entry<String, String> entry : mappings.entrySet()) {
            String key = normalize(entry.getKey());
            if (key == null) continue;
            boolean matches = exact ? normalizedModel.equals(key) : normalizedModel.startsWith(key);
            if (!matches) continue;
            Optional<AiJsonMode> parsed = parseMode(entry.getValue(), "model-json-modes[" + entry.getKey() + "]");
            if (parsed.isPresent()) return parsed;
        }
        return Optional.empty();
    }

    private AiJsonMode autoMode(String baseUrl, String model) {
        String normalizedModel = normalize(model);
        String host = host(baseUrl);

        if (containsToken(normalizedModel, "qwen")
            || containsToken(host, "dashscope")
            || containsToken(host, "aliyuncs")) {
            return AiJsonMode.PROMPT_ONLY;
        }
        return AiJsonMode.JSON_SCHEMA_STRICT;
    }

    private Optional<AiJsonMode> parseMode(String value, String source) {
        String normalized = normalize(value);
        if (normalized == null) return Optional.empty();
        String token = normalized.replace('-', '_');

        return switch (token) {
            case "strict", "json_schema", "json_schema_strict" -> Optional.of(AiJsonMode.JSON_SCHEMA_STRICT);
            case "json_object" -> Optional.of(AiJsonMode.JSON_OBJECT);
            case "prompt", "prompt_only", "none" -> Optional.of(AiJsonMode.PROMPT_ONLY);
            case "auto" -> Optional.empty();
            default -> {
                log.warn("Unsupported AI JSON mode '{}' from {}; ignoring and continuing resolution", value, source);
                yield Optional.empty();
            }
        };
    }

    private String host(String baseUrl) {
        String trimmed = trimToNull(baseUrl);
        if (trimmed == null) return null;
        try {
            String host = new URI(trimmed).getHost();
            return normalize(host);
        } catch (URISyntaxException ex) {
            return null;
        }
    }

    private boolean containsToken(String value, String token) {
        return value != null && value.contains(token);
    }

    private String normalize(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? null : trimmed.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
