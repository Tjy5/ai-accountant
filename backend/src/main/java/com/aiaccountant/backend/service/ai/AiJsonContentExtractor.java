package com.aiaccountant.backend.service.ai;

import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Extracts the first balanced top-level JSON object from a possibly-noisy provider response.
 *
 * <p>Provider models that do not honor strict JSON schema may surround the JSON with markdown
 * fences, prose, or both. This extractor is intentionally lenient: it strips a leading byte-order
 * mark, peels a single surrounding markdown fence, then scans for the first balanced
 * <code>{...}</code> block, respecting JSON string semantics so braces inside string literals do
 * not throw off the bracket counter.
 *
 * <p>The extractor does not validate that the candidate is a recognition payload — that remains
 * the caller's responsibility (typically a Jackson {@code readValue} of the extracted snippet).
 */
@Component
public class AiJsonContentExtractor {
    private static final char BOM = '\uFEFF';

    public Optional<String> extractBalancedJsonObject(String content) {
        if (content == null) return Optional.empty();

        String source = stripMarkdownFence(stripBom(content));
        for (int i = 0; i < source.length(); i++) {
            if (source.charAt(i) != '{') continue;
            Optional<String> candidate = scanBalancedObject(source, i);
            if (candidate.isPresent()) return candidate;
        }
        return Optional.empty();
    }

    private Optional<String> scanBalancedObject(String source, int start) {
        int depth = 0;
        boolean inString = false;
        boolean escape = false;

        for (int i = start; i < source.length(); i++) {
            char ch = source.charAt(i);

            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch == '\\') {
                    escape = true;
                } else if (ch == '"') {
                    inString = false;
                }
                continue;
            }

            switch (ch) {
                case '"' -> inString = true;
                case '{' -> depth++;
                case '}' -> {
                    depth--;
                    if (depth == 0) return Optional.of(source.substring(start, i + 1));
                    if (depth < 0) return Optional.empty();
                }
                default -> { }
            }
        }

        return Optional.empty();
    }

    private String stripBom(String content) {
        if (!content.isEmpty() && content.charAt(0) == BOM) {
            return content.substring(1);
        }
        return content;
    }

    private String stripMarkdownFence(String content) {
        String trimmed = content.trim();
        if (!trimmed.startsWith("```")) return trimmed;

        int firstLineBreak = trimmed.indexOf('\n');
        if (firstLineBreak < 0) return trimmed;

        int closingFence = trimmed.lastIndexOf("```");
        if (closingFence <= firstLineBreak) return trimmed;

        return trimmed.substring(firstLineBreak + 1, closingFence).trim();
    }
}
