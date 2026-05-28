package com.aiaccountant.backend.service.ai;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public interface AiProviderClient {
    AiRecognitionResult recognizeText(AiProviderConfig config, AiRecognitionRequest request);

    AiRecognitionResult recognizeImage(AiProviderConfig config, AiRecognitionRequest request);

    AiConnectionTestResult test(AiProviderConfig config);

    record AiProviderConfig(
        boolean enabled,
        String apiKey,
        String baseUrl,
        String model,
        Duration timeout,
        int maxOutputTokens,
        BigDecimal temperature
    ) {
    }

    record AiRecognitionRequest(
        Long userId,
        String text,
        String image,
        String filename,
        List<String> categories,
        String currentDate,
        String defaultCurrency
    ) {
    }

    record AiRecognitionResult(
        String reply,
        String intent,
        List<Map<String, Object>> drafts,
        boolean needsClarification,
        String clarificationQuestion,
        List<String> warnings,
        List<Object> ignored,
        String rawText
    ) {
        public Map<String, Object> toMap() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("reply", reply);
            out.put("replyType", "text");
            out.put("messages", List.of(Map.of("type", "text", "content", reply == null ? "" : reply)));
            out.put("intent", intent);
            out.put("drafts", drafts == null ? List.of() : drafts);
            out.put("needsClarification", needsClarification);
            out.put("clarificationQuestion", clarificationQuestion);
            out.put("warnings", warnings == null ? List.of() : warnings);
            out.put("ignored", ignored == null ? List.of() : ignored);
            out.put("rawText", rawText);
            out.put("timestamp", System.currentTimeMillis());
            return out;
        }
    }

    record AiConnectionTestResult(
        boolean ok,
        String model,
        String baseUrl,
        long latencyMs,
        String message
    ) {
    }
}
