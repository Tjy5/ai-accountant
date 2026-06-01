package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.entity.AiCallLog;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Service
public class OpenAiChatCompletionsClient implements AiProviderClient {
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final AiPromptFactory promptFactory;
    private final AiResponseFormatStrategy responseFormatStrategy;
    private final AiJsonContentExtractor jsonContentExtractor;
    private final AiCallLogService callLogService;

    public OpenAiChatCompletionsClient(
        WebClient.Builder webClientBuilder,
        ObjectMapper objectMapper,
        AiPromptFactory promptFactory,
        AiResponseFormatStrategy responseFormatStrategy,
        AiJsonContentExtractor jsonContentExtractor,
        AiCallLogService callLogService
    ) {
        this.webClientBuilder = webClientBuilder;
        this.objectMapper = objectMapper;
        this.promptFactory = promptFactory;
        this.responseFormatStrategy = responseFormatStrategy;
        this.jsonContentExtractor = jsonContentExtractor;
        this.callLogService = callLogService;
    }

    @Override
    public AiRecognitionResult recognizeText(AiProviderConfig config, AiRecognitionRequest request) {
        AiJsonMode jsonMode = resolveJsonMode(config);
        Map<String, Object> payload = recognitionPayload(config, jsonMode, promptFactory.textMessages(request, jsonMode));
        return callProvider(config, request.userId(), "analyze_text", payload, this::parseRecognition);
    }

    @Override
    public AiRecognitionResult recognizeImage(AiProviderConfig config, AiRecognitionRequest request) {
        AiJsonMode jsonMode = resolveJsonMode(config);
        Map<String, Object> payload = recognitionPayload(config, jsonMode, promptFactory.imageMessages(request, jsonMode));
        return callProvider(config, request.userId(), "analyze_image", payload, this::parseRecognition);
    }

    @Override
    public AiConnectionTestResult test(AiProviderConfig config) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.model());
        payload.put("temperature", 0);
        payload.put("max_tokens", 16);
        payload.put("messages", List.of(
            Map.of("role", "system", "content", "Return the word ok."),
            Map.of("role", "user", "content", "ping")
        ));
        long started = Instant.now().toEpochMilli();
        callProvider(config, config.userId(), "test_connection", payload, response -> response);
        return new AiConnectionTestResult(
            true,
            config.model(),
            config.baseUrl(),
            Instant.now().toEpochMilli() - started,
            "AI provider connection succeeded"
        );
    }

    private Map<String, Object> recognitionPayload(AiProviderConfig config, AiJsonMode jsonMode, List<Map<String, Object>> messages) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.model());
        payload.put("temperature", config.temperature());
        payload.put("max_tokens", config.maxOutputTokens());
        Map<String, Object> responseFormat = promptFactory.responseFormat(jsonMode);
        if (responseFormat != null) {
            payload.put("response_format", responseFormat);
        }
        payload.put("messages", messages);
        return payload;
    }

    private AiJsonMode resolveJsonMode(AiProviderConfig config) {
        return config.jsonMode() == null
            ? responseFormatStrategy.resolve(config.baseUrl(), config.model())
            : config.jsonMode();
    }

    private <T> T callProvider(
        AiProviderConfig config,
        Long userId,
        String operation,
        Map<String, Object> payload,
        ResponseHandler<T> handler
    ) {
        long started = Instant.now().toEpochMilli();
        Map<String, Object> response = null;
        try {
            response = send(config, payload);
            T result = handler.handle(response);
            recordCall(config, userId, operation, response, started, true, null);
            return result;
        } catch (ApiException ex) {
            recordCall(config, userId, operation, response, started, false, ex.getCode());
            throw ex;
        } catch (RuntimeException ex) {
            recordCall(config, userId, operation, response, started, false, "AI_PROVIDER_UNAVAILABLE");
            throw ex;
        }
    }

    private Map<String, Object> send(AiProviderConfig config, Map<String, Object> payload) {
        try {
            return webClientBuilder
                .baseUrl(config.baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + config.apiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build()
                .post()
                .uri("/chat/completions")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .timeout(config.timeout())
                .block(config.timeout().plusSeconds(2));
        } catch (WebClientResponseException ex) {
            throw providerError(ex);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI provider request failed", "AI_PROVIDER_UNAVAILABLE");
        }
    }

    private AiRecognitionResult parseRecognition(Map<String, Object> raw) {
        String content = extractContent(raw);
        if (content == null || content.isBlank()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI provider returned an empty response", "AI_PROVIDER_BAD_RESPONSE");
        }

        try {
            Map<String, Object> parsed = parseRecognitionContent(content);
            List<Map<String, Object>> drafts = listOfMaps(parsed.get("drafts"));
            List<String> warnings = listOfStrings(parsed.get("warnings"));
            List<Object> ignored = parsed.get("ignored") instanceof List<?> list ? List.copyOf(list) : List.of();

            return new AiRecognitionResult(
                string(parsed.get("reply")),
                string(parsed.get("intent")),
                drafts,
                bool(parsed.get("needsClarification")),
                string(parsed.get("clarificationQuestion")),
                warnings,
                ignored,
                content
            );
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI provider response was not valid JSON", "AI_RESPONSE_SCHEMA_INVALID");
        }
    }

    private Map<String, Object> parseRecognitionContent(String content) throws JsonProcessingException {
        try {
            return objectMapper.readValue(content, new TypeReference<>() {});
        } catch (JsonProcessingException directParseFailure) {
            String extracted = jsonContentExtractor.extractBalancedJsonObject(content).orElse(null);
            if (extracted == null) throw directParseFailure;
            return objectMapper.readValue(extracted, new TypeReference<>() {});
        }
    }

    private String extractContent(Map<String, Object> raw) {
        if (raw == null) return null;
        Object choicesRaw = raw.get("choices");
        if (!(choicesRaw instanceof List<?> choices) || choices.isEmpty()) return null;
        Object firstRaw = choices.get(0);
        if (!(firstRaw instanceof Map<?, ?> first)) return null;
        Object messageRaw = first.get("message");
        if (!(messageRaw instanceof Map<?, ?> message)) return null;
        Object content = message.get("content");
        if (content instanceof String s) return s;
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception ex) {
            return null;
        }
    }

    private ApiException providerError(WebClientResponseException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (ex.getStatusCode().value() == 401 || ex.getStatusCode().value() == 403) {
            return new ApiException(HttpStatus.BAD_GATEWAY, "AI provider authentication failed", "AI_PROVIDER_AUTH_FAILED");
        }
        if (ex.getStatusCode().value() == 429) {
            return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI provider rate limit reached", "AI_PROVIDER_RATE_LIMITED");
        }
        if (ex.getStatusCode().is4xxClientError()) {
            return new ApiException(HttpStatus.BAD_GATEWAY, "AI provider rejected the request", "AI_PROVIDER_BAD_REQUEST");
        }
        return new ApiException(status == null ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_GATEWAY, "AI provider is unavailable", "AI_PROVIDER_UNAVAILABLE");
    }

    private void recordCall(
        AiProviderConfig config,
        Long userId,
        String operation,
        Map<String, Object> response,
        long started,
        boolean success,
        String errorCode
    ) {
        AiCallLog entry = new AiCallLog();
        entry.setUserId(userId);
        entry.setOperation(operation);
        entry.setModel(config.model());
        entry.setBaseUrl(config.baseUrl());
        entry.setLatencyMs(latencyMs(started));
        entry.setSuccess(success);
        entry.setErrorCode(errorCode);

        Map<String, Object> usage = map(response == null ? null : response.get("usage"));
        if (usage != null) {
            entry.setPromptTokens(integer(usage.get("prompt_tokens")));
            entry.setCompletionTokens(integer(usage.get("completion_tokens")));
            entry.setTotalTokens(integer(usage.get("total_tokens")));
        }

        callLogService.record(entry);
    }

    private int latencyMs(long started) {
        long elapsed = Instant.now().toEpochMilli() - started;
        if (elapsed < 0) return 0;
        return elapsed > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) elapsed;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> listOfMaps(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream()
            .filter(Map.class::isInstance)
            .map(item -> (Map<String, Object>) item)
            .toList();
    }

    private List<String> listOfStrings(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().map(String::valueOf).toList();
    }

    private String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean bool(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.intValue() != 0;
        return "true".equalsIgnoreCase(String.valueOf(value));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> raw ? (Map<String, Object>) raw : null;
    }

    private Integer integer(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s);
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    @FunctionalInterface
    private interface ResponseHandler<T> {
        T handle(Map<String, Object> response);
    }
}
