package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class OpenAiChatCompletionsClientTest {
    private MockWebServer server;
    private OpenAiChatCompletionsClient client;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        ObjectMapper objectMapper = new ObjectMapper();
        client = new OpenAiChatCompletionsClient(
            WebClient.builder(),
            objectMapper,
            new AiPromptFactory(objectMapper)
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
            {"choices":[{"message":{"content":"not-json"}}]}
            """));

        ApiException ex = assertThrows(ApiException.class, () -> client.recognizeText(config(), request()));

        assertEquals("AI_RESPONSE_SCHEMA_INVALID", ex.getCode());
    }

    private void assertProviderCode(int status, String expectedCode) {
        server.enqueue(jsonResponse(status, "{}"));

        ApiException ex = assertThrows(ApiException.class, () -> client.test(config()));

        assertEquals(expectedCode, ex.getCode());
    }

    private MockResponse jsonResponse(int status, String body) {
        return new MockResponse()
            .setResponseCode(status)
            .setHeader("Content-Type", "application/json")
            .setBody(body);
    }

    private AiProviderConfig config() {
        return new AiProviderConfig(
            true,
            "api-key",
            "http://127.0.0.1:" + server.getPort() + "/v1",
            "gpt-test",
            Duration.ofSeconds(5),
            1200,
            BigDecimal.ZERO
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
