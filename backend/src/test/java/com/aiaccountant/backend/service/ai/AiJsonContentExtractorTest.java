package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AiJsonContentExtractorTest {
    private final AiJsonContentExtractor extractor = new AiJsonContentExtractor();

    @Test
    void extractsPureJson() {
        assertEquals("{\"ok\":true}", extractor.extractBalancedJsonObject("{\"ok\":true}").orElseThrow());
    }

    @Test
    void extractsFencedJson() {
        String content = """
            ```json
            {"ok":true}
            ```
            """;

        assertEquals("{\"ok\":true}", extractor.extractBalancedJsonObject(content).orElseThrow());
    }

    @Test
    void extractsJsonWithPrefixAndSuffixText() {
        String content = "Here is the result: {\"ok\":true} Done.";

        assertEquals("{\"ok\":true}", extractor.extractBalancedJsonObject(content).orElseThrow());
    }

    @Test
    void extractsNestedJsonObject() {
        String content = "{\"outer\":{\"inner\":true},\"items\":[{\"id\":1}]}";

        assertEquals(content, extractor.extractBalancedJsonObject(content).orElseThrow());
    }

    @Test
    void ignoresBracesInsideStrings() {
        String content = "{\"text\":\"literal { braces } and \\\"quote\\\" plus \\\\ slash\",\"ok\":true}";

        assertEquals(content, extractor.extractBalancedJsonObject(content).orElseThrow());
    }

    @Test
    void returnsEmptyForUnbalancedJson() {
        assertTrue(extractor.extractBalancedJsonObject("{\"ok\":true").isEmpty());
    }

    @Test
    void returnsEmptyForNullOrBlank() {
        assertTrue(extractor.extractBalancedJsonObject(null).isEmpty());
        assertTrue(extractor.extractBalancedJsonObject("").isEmpty());
        assertTrue(extractor.extractBalancedJsonObject("no braces here").isEmpty());
    }

    @Test
    void returnsFirstBalancedCandidate() {
        String content = "prefix {\"first\":true} middle {\"second\":true}";

        assertEquals("{\"first\":true}", extractor.extractBalancedJsonObject(content).orElseThrow());
    }

    @Test
    void stripsByteOrderMarkBeforeScanning() {
        String content = "﻿{\"ok\":true}";

        assertEquals("{\"ok\":true}", extractor.extractBalancedJsonObject(content).orElseThrow());
    }

    @Test
    void handlesFenceWithoutLanguageHint() {
        String content = """
            ```
            {"ok":true}
            ```
            """;

        assertEquals("{\"ok\":true}", extractor.extractBalancedJsonObject(content).orElseThrow());
    }
}
