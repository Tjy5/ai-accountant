package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiPromptFactoryTest {
    private final AiPromptFactory factory = new AiPromptFactory(new ObjectMapper());

    @Test
    void systemPromptSerializesAllowedCategoriesAsJsonArray() {
        List<Map<String, Object>> messages = factory.textMessages(request());
        String systemPrompt = String.valueOf(messages.get(0).get("content"));

        assertTrue(systemPrompt.contains("allowedCategories=[\"餐饮\",\"交通\"]"));
        assertFalse(systemPrompt.contains("allowedCategories=[餐饮, 交通]"));
    }

    @Test
    void strictModePromptReferencesProvidedSchema() {
        List<Map<String, Object>> messages = factory.textMessages(request(), AiJsonMode.JSON_SCHEMA_STRICT);
        String systemPrompt = String.valueOf(messages.get(0).get("content"));

        assertTrue(systemPrompt.contains("Return only JSON that matches the provided schema"));
        assertFalse(systemPrompt.contains("Do not wrap the JSON in markdown fences"));
    }

    @Test
    void jsonObjectPromptRequiresPlainJsonWithoutMarkdownFences() {
        List<Map<String, Object>> messages = factory.textMessages(request(), AiJsonMode.JSON_OBJECT);
        String systemPrompt = String.valueOf(messages.get(0).get("content"));

        assertTrue(systemPrompt.contains("Return exactly one JSON object with keys"));
        assertTrue(systemPrompt.contains("Do not wrap the JSON in markdown fences"));
        assertTrue(systemPrompt.contains("Do not add prose before or after the JSON"));
    }

    @Test
    void promptOnlyPromptMatchesJsonObjectInstruction() {
        List<Map<String, Object>> messages = factory.textMessages(request(), AiJsonMode.PROMPT_ONLY);
        String systemPrompt = String.valueOf(messages.get(0).get("content"));

        assertTrue(systemPrompt.contains("Return exactly one JSON object with keys"));
        assertTrue(systemPrompt.contains("Do not wrap the JSON in markdown fences"));
    }

    @Test
    void responseFormatReturnsJsonSchemaForStrict() {
        Map<String, Object> responseFormat = factory.responseFormat(AiJsonMode.JSON_SCHEMA_STRICT);

        assertEquals("json_schema", responseFormat.get("type"));
    }

    @Test
    void responseFormatReturnsJsonObjectForJsonObjectMode() {
        Map<String, Object> responseFormat = factory.responseFormat(AiJsonMode.JSON_OBJECT);

        assertEquals("json_object", responseFormat.get("type"));
    }

    @Test
    void responseFormatReturnsNullForPromptOnly() {
        assertNull(factory.responseFormat(AiJsonMode.PROMPT_ONLY));
    }

    private AiRecognitionRequest request() {
        return new AiRecognitionRequest(
            1L,
            "午餐 20",
            null,
            null,
            List.of("餐饮", "交通"),
            "2026-05-28",
            "CNY"
        );
    }
}
