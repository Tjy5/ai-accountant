package com.aiaccountant.backend.service.ai;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.aiaccountant.backend.entity.AiCallLog;
import com.aiaccountant.backend.mapper.AiCallLogMapper;
import java.util.concurrent.Executor;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;

class AiCallLogServiceTest {
    private static final Executor DIRECT_EXECUTOR = Runnable::run;

    @Test
    void recordNormalizesAndWritesLogEntry() {
        AiCallLogMapper mapper = mock(AiCallLogMapper.class);
        AiCallLogService service = new AiCallLogService(mapper, DIRECT_EXECUTOR);

        AiCallLog entry = new AiCallLog();
        entry.setUserId(1L);
        entry.setOperation("analyze_text");
        entry.setModel("gpt-test");
        entry.setBaseUrl("https://api.openai.com/v1");
        entry.setPromptTokens(10);
        entry.setCompletionTokens(5);
        entry.setTotalTokens(15);
        entry.setLatencyMs(123);
        entry.setSuccess(true);

        service.record(entry);

        verify(mapper).insert(argThat((ArgumentMatcher<AiCallLog>) saved ->
            saved != null
                && Long.valueOf(1L).equals(saved.getUserId())
                && "analyze_text".equals(saved.getOperation())
                && Boolean.TRUE.equals(saved.getSuccess())
                && saved.getCreatedAt() != null
        ));
    }

    @Test
    void recordFailureDoesNotAffectCaller() {
        AiCallLogMapper mapper = mock(AiCallLogMapper.class);
        doThrow(new RuntimeException("database unavailable"))
            .when(mapper)
            .insert(argThat((ArgumentMatcher<AiCallLog>) entry -> true));
        AiCallLogService service = new AiCallLogService(mapper, DIRECT_EXECUTOR);

        AiCallLog entry = new AiCallLog();
        entry.setUserId(1L);
        entry.setOperation("test_connection");
        entry.setSuccess(false);
        entry.setErrorCode("AI_PROVIDER_UNAVAILABLE");

        assertDoesNotThrow(() -> service.record(entry));
    }
}
