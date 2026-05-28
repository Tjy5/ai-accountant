package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.aiaccountant.backend.config.AppProperties;
import org.junit.jupiter.api.Test;

class AiResponseFormatStrategyTest {
    @Test
    void exactModelMappingBeatsAutoHeuristic() {
        AppProperties properties = new AppProperties();
        properties.getAi().getModelJsonModes().put("qwen3.6-plus", "json_object");
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(properties);

        assertEquals(
            AiJsonMode.JSON_OBJECT,
            strategy.resolve("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen3.6-plus")
        );
    }

    @Test
    void prefixModelMappingBeatsAutoHeuristic() {
        AppProperties properties = new AppProperties();
        properties.getAi().getModelJsonModes().put("qwen", "json_object");
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(properties);

        assertEquals(AiJsonMode.JSON_OBJECT, strategy.resolve("https://api.openai.com/v1", "qwen3.6-plus"));
    }

    @Test
    void globalJsonModeBeatsAutoHeuristic() {
        AppProperties properties = new AppProperties();
        properties.getAi().setJsonMode("prompt_only");
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(properties);

        assertEquals(AiJsonMode.PROMPT_ONLY, strategy.resolve("https://api.openai.com/v1", "gpt-4o"));
    }

    @Test
    void transientOverrideBeatsAllOtherSources() {
        AppProperties properties = new AppProperties();
        properties.getAi().setJsonMode("prompt_only");
        properties.getAi().getModelJsonModes().put("gpt", "json_object");
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(properties);

        assertEquals(
            AiJsonMode.JSON_SCHEMA_STRICT,
            strategy.resolve("https://api.openai.com/v1", "gpt-4o", "strict")
        );
    }

    @Test
    void autoHeuristicRoutesQwenModelToPromptOnly() {
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(new AppProperties());

        assertEquals(AiJsonMode.PROMPT_ONLY, strategy.resolve("https://api.openai.com/v1", "qwen3.6-plus"));
    }

    @Test
    void autoHeuristicRoutesDashscopeHostToPromptOnly() {
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(new AppProperties());

        assertEquals(
            AiJsonMode.PROMPT_ONLY,
            strategy.resolve("https://dashscope.aliyuncs.com/compatible-mode/v1", "custom-model")
        );
    }

    @Test
    void autoHeuristicRoutesOtherAliyuncsHostsToPromptOnly() {
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(new AppProperties());

        assertEquals(
            AiJsonMode.PROMPT_ONLY,
            strategy.resolve("https://chat.aliyuncs.com/v1", "custom-model")
        );
    }

    @Test
    void autoHeuristicDefaultsToStrictForUnknownModels() {
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(new AppProperties());

        assertEquals(AiJsonMode.JSON_SCHEMA_STRICT, strategy.resolve("https://api.openai.com/v1", "gpt-4o-mini"));
        assertEquals(AiJsonMode.JSON_SCHEMA_STRICT, strategy.resolve("https://api.openai.com/v1", "claude-x"));
    }

    @Test
    void unknownConfiguredModeFallsBackToAutoHeuristic() {
        AppProperties properties = new AppProperties();
        properties.getAi().setJsonMode("totally-bogus-mode");
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(properties);

        assertEquals(AiJsonMode.JSON_SCHEMA_STRICT, strategy.resolve("https://api.openai.com/v1", "gpt-4o"));
    }

    @Test
    void blankTransientOverrideFallsBackToConfiguredMode() {
        AppProperties properties = new AppProperties();
        properties.getAi().setJsonMode("json_object");
        AiResponseFormatStrategy strategy = new AiResponseFormatStrategy(properties);

        assertEquals(AiJsonMode.JSON_OBJECT, strategy.resolve("https://api.openai.com/v1", "gpt-4o", "   "));
    }
}
