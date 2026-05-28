package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiPromptFactoryTest {
    @Test
    void systemPromptSerializesAllowedCategoriesAsJsonArray() {
        AiPromptFactory factory = new AiPromptFactory(new ObjectMapper());
        AiRecognitionRequest request = new AiRecognitionRequest(
            1L,
            "午餐 20",
            null,
            null,
            List.of("餐饮", "交通"),
            "2026-05-28",
            "CNY"
        );

        List<Map<String, Object>> messages = factory.textMessages(request);
        String systemPrompt = String.valueOf(messages.get(0).get("content"));

        assertTrue(systemPrompt.contains("allowedCategories=[\"餐饮\",\"交通\"]"));
        assertFalse(systemPrompt.contains("allowedCategories=[餐饮, 交通]"));
    }
}
