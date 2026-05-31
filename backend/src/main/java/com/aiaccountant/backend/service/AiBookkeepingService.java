package com.aiaccountant.backend.service;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.Category;
import com.aiaccountant.backend.entity.UserSettings;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserSettingsMapper;
import com.aiaccountant.backend.service.ai.AiConfigurationResolver;
import com.aiaccountant.backend.service.ai.AiProviderClient;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiProviderConfig;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionRequest;
import com.aiaccountant.backend.service.ai.AiProviderClient.AiRecognitionResult;
import com.aiaccountant.backend.service.ai.AiRecognitionNormalizer;
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
    private final CategoryService categoryService;
    private final AiConfigurationResolver aiConfigurationResolver;
    private final AiProviderClient aiProviderClient;
    private final AiRecognitionNormalizer aiRecognitionNormalizer;
    private final TransactionService transactionService;
    private final UserSettingsMapper userSettingsMapper;

    public AiBookkeepingService(
        AppProperties properties,
        CategoryService categoryService,
        AiConfigurationResolver aiConfigurationResolver,
        AiProviderClient aiProviderClient,
        AiRecognitionNormalizer aiRecognitionNormalizer,
        TransactionService transactionService,
        UserSettingsMapper userSettingsMapper
    ) {
        this.properties = properties;
        this.categoryService = categoryService;
        this.aiConfigurationResolver = aiConfigurationResolver;
        this.aiProviderClient = aiProviderClient;
        this.aiRecognitionNormalizer = aiRecognitionNormalizer;
        this.transactionService = transactionService;
        this.userSettingsMapper = userSettingsMapper;
    }

    public Map<String, Object> analyze(Long userId, Map<String, Object> body) {
        requireAiEnabled();
        String text = RequestValues.trimToNull(body == null ? null : body.get("text"));
        if (text == null) throw new ApiException(HttpStatus.BAD_REQUEST, "text is required");
        if (text.length() > MAX_TEXT) throw new ApiException(HttpStatus.BAD_REQUEST, "text is too long");

        try {
            AiProviderConfig config = aiConfigurationResolver.resolve(userId);
            AiRecognitionResult raw = aiProviderClient.recognizeText(config, request(userId, text, null, null));
            return aiRecognitionNormalizer.normalize(userId, raw).toMap();
        } catch (ApiException ex) {
            if (!fallbackAllowed(ex)) throw ex;
            return localFallback(userId, text, "AI provider failed; local deterministic parsing was used: " + ex.getMessage());
        }
    }

    public Map<String, Object> analyzeImage(Long userId, Map<String, Object> body) {
        requireAiEnabled();
        NormalizedImage image = normalizeImagePayload(body == null ? null : body.get("image"));
        String textHint = RequestValues.trimToNull(RequestValues.first(body, "text", "ocrText", "description"));
        String filename = RequestValues.trimToNull(RequestValues.first(body, "filename", "fileName"));

        try {
            AiProviderConfig config = aiConfigurationResolver.resolve(userId);
            AiRecognitionResult raw = aiProviderClient.recognizeImage(config, request(userId, textHint, image.dataUri(), filename));
            return aiRecognitionNormalizer.normalize(userId, raw).toMap();
        } catch (ApiException ex) {
            if (!fallbackAllowed(ex)) throw ex;
            if (textHint != null) {
                return localFallback(userId, textHint, "AI vision provider failed; local text fallback was used: " + ex.getMessage());
            }
            return recognitionResponse(
                "Image input was accepted but AI vision recognition failed.",
                List.of(),
                true,
                "Please enter the amount and purpose from the receipt, or configure a working AI provider in Settings.",
                List.of("AI vision provider failed and no OCR text fallback was available: " + ex.getMessage())
            );
        }
    }

    public Map<String, Object> commit(Long userId, Map<String, Object> body) {
        return transactionService.commitRecognizedDrafts(userId, body);
    }

    private AiRecognitionRequest request(Long userId, String text, String image, String filename) {
        List<String> categories = categoryService.listInternal(userId).stream()
            .map(Category::getName)
            .filter(name -> name != null && !name.isBlank())
            .toList();
        return new AiRecognitionRequest(
            userId,
            text,
            image,
            filename,
            categories,
            LocalDate.now().toString(),
            defaultCurrency(userId)
        );
    }

    private String defaultCurrency(Long userId) {
        UserSettings settings = userSettingsMapper.findActiveByUserId(userId);
        String currency = settings == null ? null : RequestValues.trimToNull(settings.getDefaultCurrency());
        return currency == null ? "USD" : currency;
    }

    private void requireAiEnabled() {
        if (!properties.getAi().isEnabled()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI provider is disabled", "AI_PROVIDER_DISABLED");
        }
    }

    private boolean fallbackAllowed(ApiException ex) {
        return !"AI_PROVIDER_DISABLED".equals(ex.getCode());
    }

    private Map<String, Object> localFallback(Long userId, String text, String warning) {
        List<Map<String, Object>> drafts = extractSimpleDrafts(userId, text);
        boolean needsClarification = drafts.isEmpty();
        String reply = needsClarification
            ? "本喵没能看懂这一笔账单喵~ 可以跟本喵说说具体的金额和用途吗？比如：午餐30喵~"
            : "好棒喵！本喵已经帮主人认出了 " + drafts.size() + " 笔账单草稿，主人快来看看对不对喵~";
        String clarificationQuestion = needsClarification
            ? "主人可以补充具体金额和用途吗？比如：午餐 30 喵~"
            : null;

        return recognitionResponse(
            reply,
            drafts,
            needsClarification,
            clarificationQuestion,
            needsClarification
                ? List.of(warning, "The fallback parser did not contain enough information to create a transaction draft.")
                : List.of(warning)
        );
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

    private NormalizedImage normalizeImagePayload(Object raw) {
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
        String dataUri = image.startsWith("data:") ? image : "data:image/png;base64," + base64;
        return new NormalizedImage(dataUri, base64);
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

    private record NormalizedImage(String dataUri, String base64) {
    }
}
