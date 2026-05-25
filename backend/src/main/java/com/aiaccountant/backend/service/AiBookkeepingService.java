package com.aiaccountant.backend.service;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.Category;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.util.AiBaseUrlValidator;
import com.aiaccountant.backend.util.RequestValues;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AiBookkeepingService {
    private static final int MAX_TEXT = 8000;
    private static final int MAX_IMAGE_BASE64 = 8 * 1024 * 1024;
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(\\d+(?:\\.\\d{1,2})?)");
    private static final Set<String> IMAGE_MIME_TYPES = Set.of("image/png", "image/jpeg", "image/jpg", "image/webp");

    private final AppProperties properties;
    private final AiBaseUrlValidator baseUrlValidator;
    private final CategoryService categoryService;
    private final TransactionService transactionService;

    public AiBookkeepingService(
        AppProperties properties,
        AiBaseUrlValidator baseUrlValidator,
        CategoryService categoryService,
        TransactionService transactionService
    ) {
        this.properties = properties;
        this.baseUrlValidator = baseUrlValidator;
        this.categoryService = categoryService;
        this.transactionService = transactionService;
    }

    public Map<String, Object> analyze(Long userId, Map<String, Object> body) {
        requireProviderConfigured();
        String text = RequestValues.trimToNull(body == null ? null : body.get("text"));
        if (text == null) throw new ApiException(HttpStatus.BAD_REQUEST, "text is required");
        if (text.length() > MAX_TEXT) throw new ApiException(HttpStatus.BAD_REQUEST, "text is too long");

        List<Map<String, Object>> drafts = extractSimpleDrafts(userId, text);
        boolean needsClarification = drafts.isEmpty();
        return recognitionResponse(
            needsClarification ? "No complete bookkeeping draft was recognized." : "Recognized " + drafts.size() + " bookkeeping draft(s).",
            drafts,
            needsClarification,
            needsClarification ? "Please include an amount and purpose, for example: lunch 30." : null,
            needsClarification
                ? List.of("The input did not contain enough information to create a transaction draft.")
                : List.of("Provider configuration is present; local deterministic parsing produced the draft structure.")
        );
    }

    public Map<String, Object> analyzeImage(Long userId, Map<String, Object> body) {
        requireProviderConfigured();
        normalizeImagePayload(body == null ? null : body.get("image"));
        String textHint = RequestValues.trimToNull(RequestValues.first(body, "text", "ocrText", "description"));
        List<Map<String, Object>> drafts = textHint == null ? List.of() : extractSimpleDrafts(userId, textHint);
        boolean needsClarification = drafts.isEmpty();
        return recognitionResponse(
            needsClarification ? "Image input was accepted but no complete draft was recognized." : "Recognized " + drafts.size() + " bookkeeping draft(s) from image context.",
            drafts,
            needsClarification,
            needsClarification ? "Please confirm the amount, category, and date from the image." : null,
            needsClarification
                ? List.of("Image validation passed; no local OCR text was available for deterministic draft extraction.")
                : List.of("Image validation passed; supplied OCR context was converted to draft structure.")
        );
    }

    public Map<String, Object> commit(Long userId, Map<String, Object> body) {
        return transactionService.commitRecognizedDrafts(userId, body);
    }

    private void requireProviderConfigured() {
        AppProperties.Ai ai = properties.getAi();
        if (!ai.isEnabled()) throw new ApiException(HttpStatus.BAD_REQUEST, "AI provider is disabled", "AI_PROVIDER_DISABLED");
        if (RequestValues.trimToNull(ai.getApiKey()) == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI provider is not configured", "AI_PROVIDER_NOT_CONFIGURED");
        }
        baseUrlValidator.normalize(ai.getBaseUrl());
        if (RequestValues.trimToNull(ai.getModel()) == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI model is not configured", "AI_MODEL_NOT_CONFIGURED");
        }
    }

    private List<Map<String, Object>> extractSimpleDrafts(Long userId, String text) {
        List<Map<String, Object>> drafts = new ArrayList<>();
        Matcher matcher = AMOUNT_PATTERN.matcher(text);
        int index = 0;
        while (matcher.find() && drafts.size() < 20) {
            BigDecimal amount = RequestValues.decimal(matcher.group(1));
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) continue;
            String type = inferType(text);
            String category = categoryService.resolveCategoryName(userId, bestCategoryName(userId, text), type);
            Map<String, Object> draft = new LinkedHashMap<>();
            draft.put("_draftId", "draft_" + System.currentTimeMillis() + "_" + index++);
            draft.put("confirmed", false);
            draft.put("type", type);
            draft.put("category", category);
            draft.put("amount", amount);
            draft.put("description", text.length() > 120 ? text.substring(0, 120) : text);
            draft.put("date", LocalDate.now().toString());
            draft.put("confidence", 0.5);
            drafts.add(draft);
        }
        return drafts;
    }

    private String bestCategoryName(Long userId, String text) {
        for (Category category : categoryService.listInternal(userId)) {
            if (category.getName() != null && text.contains(category.getName())) return category.getName();
        }
        return null;
    }

    private String inferType(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (text.contains("收入") || text.contains("工资") || text.contains("奖金") || lower.contains("income") || lower.contains("salary")) {
            return "income";
        }
        return "expense";
    }

    private String normalizeImagePayload(Object raw) {
        String image = RequestValues.trimToNull(raw);
        if (image == null) throw new ApiException(HttpStatus.BAD_REQUEST, "image is required");
        String base64 = image;
        int comma = base64.indexOf(",");
        if (base64.startsWith("data:")) {
            if (comma < 0) throw new ApiException(HttpStatus.BAD_REQUEST, "image data URI is invalid");
            String metadata = base64.substring("data:".length(), comma).toLowerCase(Locale.ROOT);
            if (!metadata.endsWith(";base64")) throw new ApiException(HttpStatus.BAD_REQUEST, "image data URI must be base64");
            String mime = metadata.substring(0, metadata.length() - ";base64".length());
            if (!IMAGE_MIME_TYPES.contains(mime)) throw new ApiException(HttpStatus.BAD_REQUEST, "image format is not supported");
            base64 = base64.substring(comma + 1);
        }
        if (base64.length() > MAX_IMAGE_BASE64) throw new ApiException(HttpStatus.BAD_REQUEST, "image is too large");
        try {
            Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "image must be valid base64");
        }
        return base64;
    }

    private Map<String, Object> recognitionResponse(
        String reply,
        List<Map<String, Object>> drafts,
        boolean needsClarification,
        String clarificationQuestion,
        List<String> warnings
    ) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("reply", reply);
        out.put("replyType", "text");
        out.put("messages", List.of(Map.of("type", "text", "content", reply)));
        out.put("intent", needsClarification ? "clarification" : "bookkeeping");
        out.put("drafts", drafts);
        out.put("needsClarification", needsClarification);
        out.put("clarificationQuestion", clarificationQuestion);
        out.put("warnings", warnings);
        out.put("ignored", List.of());
        out.put("timestamp", System.currentTimeMillis());
        return out;
    }
}
