package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiConnectionTestResult;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionResult;
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

    public OpenAiChatCompletionsClient(
        WebClient.Builder webClientBuilder,
        ObjectMapper objectMapper,
        AiPromptFactory promptFactory
    ) {
        this.webClientBuilder = webClientBuilder;
        this.objectMapper = objectMapper;
        this.promptFactory = promptFactory;
    }

    @Override
    public AiRecognitionResult recognizeText(AiProviderConfig config, AiRecognitionRequest request) {
        Map<String, Object> payload = recognitionPayload(config, promptFactory.textMessages(request));
        return parseRecognition(send(config, payload));
    }

    @Override
    public AiRecognitionResult recognizeImage(AiProviderConfig config, AiRecognitionRequest request) {
        Map<String, Object> payload = recognitionPayload(config, promptFactory.imageMessages(request));
        return parseRecognition(send(config, payload));
    }

    @Override
    public AiConnectionTestResult test(AiProviderConfig config) {
        long started = Instant.now().toEpochMilli();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.model());
        payload.put("temperature", 0);
        payload.put("max_tokens", 16);
        payload.put("messages", List.of(
            Map.of("role", "system", "content", "Return the word ok."),
            Map.of("role", "user", "content", "ping")
        ));
        send(config, payload);
        return new AiConnectionTestResult(
            true,
            config.model(),
            config.baseUrl(),
            Instant.now().toEpochMilli() - started,
            "AI provider connection succeeded"
        );
    }

    private Map<String, Object> recognitionPayload(AiProviderConfig config, List<Map<String, Object>> messages) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.model());
        payload.put("temperature", config.temperature());
        payload.put("max_tokens", config.maxOutputTokens());
        payload.put("response_format", promptFactory.responseFormat());
        payload.put("messages", messages);
        return payload;
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
            Map<String, Object> parsed = objectMapper.readValue(content, new TypeReference<>() {});
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

    @SuppressWarnings("unchecked")
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
}
