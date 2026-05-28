package com.aiaccountant.backend.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class AiPromptFactory {
    private final ObjectMapper objectMapper;

    public AiPromptFactory(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> textMessages(AiRecognitionRequest request) {
        return textMessages(request, AiJsonMode.JSON_SCHEMA_STRICT);
    }

    public List<Map<String, Object>> textMessages(AiRecognitionRequest request, AiJsonMode jsonMode) {
        return List.of(
            message("system", systemPrompt(request, jsonMode)),
            message("user", "Parse the following bookkeeping text into transaction drafts:\n\n" + nullToEmpty(request.text()))
        );
    }

    public List<Map<String, Object>> imageMessages(AiRecognitionRequest request) {
        return imageMessages(request, AiJsonMode.JSON_SCHEMA_STRICT);
    }

    public List<Map<String, Object>> imageMessages(AiRecognitionRequest request, AiJsonMode jsonMode) {
        List<Map<String, Object>> content = new ArrayList<>();
        String hint = nullToEmpty(request.text());
        String filename = nullToEmpty(request.filename());
        content.add(object(
            "type", "text",
            "text", "Extract bookkeeping transaction drafts from this receipt or financial image."
                + (hint.isBlank() ? "" : "\nUser note: " + hint)
                + (filename.isBlank() ? "" : "\nFilename: " + filename)
        ));
        content.add(object(
            "type", "image_url",
            "image_url", object("url", request.image())
        ));
        return List.of(
            message("system", systemPrompt(request, jsonMode)),
            object("role", "user", "content", content)
        );
    }

    public Map<String, Object> responseFormat() {
        return responseFormat(AiJsonMode.JSON_SCHEMA_STRICT);
    }

    public Map<String, Object> responseFormat(AiJsonMode jsonMode) {
        AiJsonMode mode = jsonMode == null ? AiJsonMode.JSON_SCHEMA_STRICT : jsonMode;
        return switch (mode) {
            case JSON_SCHEMA_STRICT -> object(
                "type", "json_schema",
                "json_schema", object(
                    "name", "bookkeeping_recognition",
                    "strict", true,
                    "schema", schema()
                )
            );
            case JSON_OBJECT -> object("type", "json_object");
            case PROMPT_ONLY -> null;
        };
    }

    private String systemPrompt(AiRecognitionRequest request, AiJsonMode jsonMode) {
        return """
            You are an AI bookkeeping parser for a personal finance application.
            %s

            Rules:
            - Create transaction drafts only when an amount is present or visible.
            - Do not invent amounts, merchants, or dates.
            - Use currentDate when no transaction date is available.
            - Split multiple clearly separate transactions into multiple drafts.
            - For receipts, prefer the final total as one expense unless the image clearly contains multiple separate receipts or payments.
            - type must be income or expense.
            - category must be one of the allowed categories. Use 其他 when uncertain.
            - confidence must be between 0 and 1.
            - Ask for clarification when the input lacks enough information to create a draft.

            Context:
            currentDate=%s
            defaultCurrency=%s
            allowedCategories=%s
            """.formatted(
                jsonInstruction(jsonMode),
                request.currentDate(),
                request.defaultCurrency(),
                allowedCategoriesJson(request)
            );
    }

    private String jsonInstruction(AiJsonMode jsonMode) {
        AiJsonMode mode = jsonMode == null ? AiJsonMode.JSON_SCHEMA_STRICT : jsonMode;
        return switch (mode) {
            case JSON_SCHEMA_STRICT -> "Return only JSON that matches the provided schema.";
            case JSON_OBJECT, PROMPT_ONLY -> "Return exactly one JSON object with keys: "
                + "intent, reply, needsClarification, clarificationQuestion, drafts, warnings, ignored. "
                + "Do not wrap the JSON in markdown fences. Do not add prose before or after the JSON.";
        };
    }

    private String allowedCategoriesJson(AiRecognitionRequest request) {
        try {
            return objectMapper.writeValueAsString(request.categories() == null ? List.of() : request.categories());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize AI categories", ex);
        }
    }

    private Map<String, Object> schema() {
        Map<String, Object> draft = object(
            "type", "object",
            "additionalProperties", false,
            "required", List.of("type", "category", "amount", "currency", "date", "description", "merchant", "confidence", "sourceText"),
            "properties", object(
                "type", object("type", "string", "enum", List.of("income", "expense")),
                "category", object("type", "string"),
                "amount", object("type", "number", "exclusiveMinimum", 0),
                "currency", object("type", "string"),
                "date", object("type", "string", "description", "ISO date YYYY-MM-DD"),
                "description", object("type", "string"),
                "merchant", object("type", List.of("string", "null")),
                "confidence", object("type", "number", "minimum", 0, "maximum", 1),
                "sourceText", object("type", List.of("string", "null"))
            )
        );

        return object(
            "type", "object",
            "additionalProperties", false,
            "required", List.of("intent", "reply", "needsClarification", "clarificationQuestion", "drafts", "warnings", "ignored"),
            "properties", object(
                "intent", object("type", "string", "enum", List.of("bookkeeping", "clarification", "none")),
                "reply", object("type", "string"),
                "needsClarification", object("type", "boolean"),
                "clarificationQuestion", object("type", List.of("string", "null")),
                "drafts", object("type", "array", "items", draft, "maxItems", 20),
                "warnings", object("type", "array", "items", object("type", "string"), "maxItems", 20),
                "ignored", object("type", "array", "items", object("type", "string"), "maxItems", 20)
            )
        );
    }

    private Map<String, Object> message(String role, String content) {
        return object("role", role, "content", content);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private Map<String, Object> object(Object... values) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            out.put(String.valueOf(values[i]), values[i + 1]);
        }
        return out;
    }
}
