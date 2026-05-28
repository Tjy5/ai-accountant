package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiaccountant.backend.service.CategoryService;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionResult;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiRecognitionNormalizerTest {
    @Test
    void dropsInvalidDraftsAndRequestsClarificationWhenNoDraftsRemain() {
        CategoryService categoryService = mock(CategoryService.class);
        AiRecognitionNormalizer normalizer = new AiRecognitionNormalizer(categoryService);

        AiRecognitionResult result = normalizer.normalize(1L, raw(List.of(
            Map.of("type", "transfer", "amount", 12),
            Map.of("type", "expense", "amount", 0)
        )));

        assertTrue(result.drafts().isEmpty());
        assertTrue(result.needsClarification());
        assertEquals("clarification", result.intent());
        assertTrue(result.warnings().contains("AI returned drafts, but none passed validation."));
        assertEquals(2, result.ignored().size());
    }

    @Test
    void normalizesDateCategoryAndOptionalMetadata() {
        CategoryService categoryService = mock(CategoryService.class);
        when(categoryService.resolveCategoryName(1L, "Lunch", "expense")).thenReturn("餐饮");
        AiRecognitionNormalizer normalizer = new AiRecognitionNormalizer(categoryService);

        AiRecognitionResult result = normalizer.normalize(1L, raw(List.of(Map.of(
            "type", "expense",
            "category", "Lunch",
            "amount", 18.5,
            "currency", "CNY",
            "description", "Team lunch",
            "merchant", "Codex Cafe",
            "confidence", 1.5,
            "sourceText", "Codex Cafe Team lunch 18.5"
        ))));

        Map<String, Object> draft = result.drafts().get(0);
        assertFalse(result.needsClarification());
        assertEquals("餐饮", draft.get("category"));
        assertEquals("CNY", draft.get("currency"));
        assertEquals("Codex Cafe", draft.get("merchant"));
        assertEquals("Codex Cafe Team lunch 18.5", draft.get("sourceText"));
        assertEquals("1", String.valueOf(draft.get("confidence")));
        assertTrue(String.valueOf(draft.get("date")).matches("\\d{4}-\\d{2}-\\d{2}"));
    }

    private AiRecognitionResult raw(List<Map<String, Object>> drafts) {
        return new AiRecognitionResult(
            "",
            "bookkeeping",
            drafts,
            false,
            null,
            List.of(),
            List.of(),
            null
        );
    }
}
