package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.service.CategoryService;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionResult;
import com.aiaccountant.backend.util.RequestValues;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AiRecognitionNormalizer {
    private static final Set<String> VALID_TYPES = Set.of("income", "expense");

    private final CategoryService categoryService;

    public AiRecognitionNormalizer(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    public AiRecognitionResult normalize(Long userId, AiRecognitionResult raw) {
        if (raw == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI provider returned an empty response", "AI_PROVIDER_BAD_RESPONSE");
        }

        List<Map<String, Object>> drafts = new ArrayList<>();
        List<String> warnings = new ArrayList<>(raw.warnings() == null ? List.of() : raw.warnings());
        List<Object> ignored = new ArrayList<>(raw.ignored() == null ? List.of() : raw.ignored());

        int index = 0;
        for (Map<String, Object> draft : raw.drafts() == null ? List.<Map<String, Object>>of() : raw.drafts()) {
            Map<String, Object> normalized = normalizeDraft(userId, draft, index++);
            if (normalized == null) {
                ignored.add("Dropped invalid AI draft: " + safeDescription(draft));
            } else {
                drafts.add(normalized);
            }
        }

        if (raw.drafts() != null && !raw.drafts().isEmpty() && drafts.isEmpty()) {
            warnings.add("AI returned drafts, but none passed validation.");
        }

        boolean needsClarification = raw.needsClarification() || drafts.isEmpty();
        String reply = RequestValues.trimToNull(raw.reply());
        if (reply == null) {
            reply = needsClarification
                ? "I need more information before creating a bookkeeping draft."
                : "Recognized " + drafts.size() + " bookkeeping draft(s).";
        }

        return new AiRecognitionResult(
            reply,
            needsClarification ? "clarification" : "bookkeeping",
            drafts,
            needsClarification,
            raw.clarificationQuestion(),
            warnings,
            ignored,
            raw.rawText()
        );
    }

    private Map<String, Object> normalizeDraft(Long userId, Map<String, Object> raw, int index) {
        if (raw == null) return null;

        String type = RequestValues.trimToNull(RequestValues.first(raw, "type"));
        if (type == null || !VALID_TYPES.contains(type)) return null;

        BigDecimal amount = RequestValues.decimal(RequestValues.first(raw, "amount"));
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return null;

        LocalDate date = parseDate(RequestValues.first(raw, "date"));
        if (date == null) date = LocalDate.now();

        String category = RequestValues.trimToNull(RequestValues.first(raw, "category", "categoryName"));
        category = categoryService.resolveCategoryName(userId, category, type);

        String description = RequestValues.trimToNull(RequestValues.first(raw, "description", "memo", "note"));
        String merchant = RequestValues.trimToNull(RequestValues.first(raw, "merchant"));
        if (description == null) description = merchant == null ? category : merchant;
        if (description.length() > 1000) description = description.substring(0, 1000);

        BigDecimal confidence = RequestValues.decimal(RequestValues.first(raw, "confidence"));
        if (confidence == null) confidence = new BigDecimal("0.75");
        confidence = confidence.max(BigDecimal.ZERO).min(BigDecimal.ONE);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("_draftId", "ai_" + System.currentTimeMillis() + "_" + index);
        out.put("confirmed", false);
        out.put("type", type);
        out.put("category", category);
        out.put("amount", amount);
        out.put("currency", RequestValues.trimToNull(RequestValues.first(raw, "currency")));
        out.put("date", date.toString());
        out.put("description", description);
        out.put("merchant", merchant);
        out.put("confidence", confidence);
        out.put("sourceText", RequestValues.trimToNull(RequestValues.first(raw, "sourceText", "source_text")));
        return out;
    }

    private LocalDate parseDate(Object value) {
        String raw = RequestValues.trimToNull(value);
        if (raw == null) return null;
        try {
            return LocalDate.parse(raw.substring(0, Math.min(10, raw.length())));
        } catch (Exception ex) {
            return null;
        }
    }

    private String safeDescription(Map<String, Object> raw) {
        String text = String.valueOf(raw);
        return text.length() > 160 ? text.substring(0, 160) : text;
    }
}
