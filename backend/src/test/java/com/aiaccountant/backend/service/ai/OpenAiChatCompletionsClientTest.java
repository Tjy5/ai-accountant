package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class OpenAiChatCompletionsClientTest {
    private MockWebServer server;
    private OpenAiChatCompletionsClient client;
    private AiCallLogService callLogService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        objectMapper = new ObjectMapper();
        callLogService = mock(AiCallLogService.class);
        AppProperties properties = new AppProperties();
        client = new OpenAiChatCompletionsClient(
            WebClient.builder(),
            objectMapper,
            new AiPromptFactory(objectMapper),
            new AiResponseFormatStrategy(properties),
            new AiJsonContentExtractor(),
            callLogService
        );
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void mapsProviderHttpErrorsToStableCodes() {
        assertProviderCode(401, "AI_PROVIDER_AUTH_FAILED");
        assertProviderCode(429, "AI_PROVIDER_RATE_LIMITED");
        assertProviderCode(500, "AI_PROVIDER_UNAVAILABLE");
    }

    @Test
    void invalidJsonContentThrowsSchemaInvalid() {
        server.enqueue(jsonResponse(200, """
            {"choices":[{"message":{"content":"not-json"}}],"usage":{"prompt_tokens":11,"completion_tokens":3,"total_tokens":14}}
            """));

        ApiException ex = assertThrows(ApiException.class, () -> client.recognizeText(config(), request()));

        assertEquals("AI_RESPONSE_SCHEMA_INVALID", ex.getCode());
        verify(callLogService).record(argThat(entry ->
            Long.valueOf(1L).equals(entry.getUserId())
                && "analyze_text".equals(entry.getOperation())
                && Boolean.FALSE.equals(entry.getSuccess())
                && "AI_RESPONSE_SCHEMA_INVALID".equals(entry.getErrorCode())
                && Integer.valueOf(11).equals(entry.getPromptTokens())
                && Integer.valueOf(3).equals(entry.getCompletionTokens())
                && Integer.valueOf(14).equals(entry.getTotalTokens())
        ));
    }

    @Test
    void successfulRecognitionRecordsUsageMetrics() {
        server.enqueue(successfulRecognitionResponse());

        client.recognizeText(config(), request());

        verify(callLogService).record(argThat(entry ->
            Long.valueOf(1L).equals(entry.getUserId())
                && "analyze_text".equals(entry.getOperation())
                && Boolean.TRUE.equals(entry.getSuccess())
                && entry.getErrorCode() == null
                && "gpt-test".equals(entry.getModel())
                && config().baseUrl().equals(entry.getBaseUrl())
                && Integer.valueOf(12).equals(entry.getPromptTokens())
                && Integer.valueOf(8).equals(entry.getCompletionTokens())
                && Integer.valueOf(20).equals(entry.getTotalTokens())
                && entry.getLatencyMs() != null
                && entry.getLatencyMs() >= 0
        ));
    }

    @Test
    void lenientExtractionAcceptsFencedJsonWithSurroundingText() {
        server.enqueue(jsonResponse(200, """
            {
              "choices": [
                {
                  "message": {
                    "content": "Here is the result:\\n```json\\n{\\"intent\\":\\"bookkeeping\\",\\"reply\\":\\"ok\\",\\"needsClarification\\":false,\\"clarificationQuestion\\":null,\\"drafts\\":[],\\"warnings\\":[],\\"ignored\\":[]}\\n```\\nDone"
                  }
                }
              ],
              "usage": {"prompt_tokens":12,"completion_tokens":8,"total_tokens":20}
            }
            """));

        AiRecognitionResult result = client.recognizeText(config(), request());

        assertEquals("ok", result.reply());
        verify(callLogService).record(argThat(entry ->
            Long.valueOf(1L).equals(entry.getUserId())
                && "analyze_text".equals(entry.getOperation())
                && Boolean.TRUE.equals(entry.getSuccess())
                && entry.getErrorCode() == null
        ));
    }

    @Test
    void promptOnlyModeOmitsResponseFormat() throws Exception {
        server.enqueue(successfulRecognitionResponse());

        client.recognizeText(config(AiJsonMode.PROMPT_ONLY), request());

        Map<String, Object> payload = capturedRecognitionPayload();
        assertFalse(payload.containsKey("response_format"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void jsonObjectModeWritesJsonObjectResponseFormat() throws Exception {
        server.enqueue(successfulRecognitionResponse());

        client.recognizeText(config(AiJsonMode.JSON_OBJECT), request());

        Map<String, Object> payload = capturedRecognitionPayload();
        Map<String, Object> responseFormat = (Map<String, Object>) payload.get("response_format");
        assertEquals("json_object", responseFormat.get("type"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void strictModeWritesJsonSchemaResponseFormat() throws Exception {
        server.enqueue(successfulRecognitionResponse());

        client.recognizeText(config(AiJsonMode.JSON_SCHEMA_STRICT), request());

        Map<String, Object> payload = capturedRecognitionPayload();
        Map<String, Object> responseFormat = (Map<String, Object>) payload.get("response_format");
        assertEquals("json_schema", responseFormat.get("type"));
    }

    private void assertProviderCode(int status, String expectedCode) {
        server.enqueue(jsonResponse(status, "{}"));

        ApiException ex = assertThrows(ApiException.class, () -> client.test(config()));

        assertEquals(expectedCode, ex.getCode());
        verify(callLogService).record(argThat(entry ->
            Long.valueOf(1L).equals(entry.getUserId())
                && "test_connection".equals(entry.getOperation())
                && Boolean.FALSE.equals(entry.getSuccess())
                && expectedCode.equals(entry.getErrorCode())
        ));
    }

    private Map<String, Object> capturedRecognitionPayload() throws Exception {
        RecordedRequest recorded = server.takeRequest();
        return objectMapper.readValue(recorded.getBody().readUtf8(), new TypeReference<>() {});
    }

    private MockResponse jsonResponse(int status, String body) {
        return new MockResponse()
            .setResponseCode(status)
            .setHeader("Content-Type", "application/json")
            .setBody(body);
    }

    private MockResponse successfulRecognitionResponse() {
        return jsonResponse(200, """
            {
              "choices": [
                {
                  "message": {
                    "content": "{\\"intent\\":\\"bookkeeping\\",\\"reply\\":\\"ok\\",\\"needsClarification\\":false,\\"clarificationQuestion\\":null,\\"drafts\\":[],\\"warnings\\":[],\\"ignored\\":[]}"
                  }
                }
              ],
              "usage": {"prompt_tokens":12,"completion_tokens":8,"total_tokens":20}
            }
            """);
    }

    private AiProviderConfig config() {
        return config(AiJsonMode.JSON_SCHEMA_STRICT);
    }

    private AiProviderConfig config(AiJsonMode jsonMode) {
        return new AiProviderConfig(
            1L,
            true,
            "api-key",
            "http://127.0.0.1:" + server.getPort() + "/v1",
            "gpt-test",
            Duration.ofSeconds(5),
            1200,
            BigDecimal.ZERO,
            jsonMode
        );
    }

    private AiRecognitionRequest request() {
        return new AiRecognitionRequest(
            1L,
            "午餐 20",
            null,
            null,
            List.of("餐饮"),
            "2026-05-28",
            "CNY"
        );
    }
}
