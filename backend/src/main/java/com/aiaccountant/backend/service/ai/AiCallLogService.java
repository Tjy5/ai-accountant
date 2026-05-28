package com.aiaccountant.backend.service.ai;

import com.aiaccountant.backend.entity.AiCallLog;
import com.aiaccountant.backend.mapper.AiCallLogMapper;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ForkJoinPool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AiCallLogService {
    private static final Logger log = LoggerFactory.getLogger(AiCallLogService.class);

    private final AiCallLogMapper mapper;
    private final Executor executor;

    @Autowired
    public AiCallLogService(AiCallLogMapper mapper) {
        this(mapper, ForkJoinPool.commonPool());
    }

    AiCallLogService(AiCallLogMapper mapper, Executor executor) {
        this.mapper = mapper;
        this.executor = executor;
    }

    public void record(AiCallLog entry) {
        if (entry == null) return;
        AiCallLog normalized = normalize(entry);
        try {
            CompletableFuture.runAsync(() -> insertSafely(normalized), executor);
        } catch (RuntimeException ex) {
            log.warn("Could not schedule AI call log write", ex);
        }
    }

    private void insertSafely(AiCallLog entry) {
        try {
            mapper.insert(entry);
        } catch (Exception ex) {
            log.warn("Could not write AI call log", ex);
        }
    }

    private AiCallLog normalize(AiCallLog source) {
        AiCallLog out = new AiCallLog();
        out.setUserId(source.getUserId());
        out.setOperation(limit(source.getOperation(), 32));
        out.setModel(limit(source.getModel(), 100));
        out.setBaseUrl(limit(source.getBaseUrl(), 255));
        out.setPromptTokens(source.getPromptTokens());
        out.setCompletionTokens(source.getCompletionTokens());
        out.setTotalTokens(source.getTotalTokens());
        out.setLatencyMs(source.getLatencyMs());
        out.setSuccess(Boolean.TRUE.equals(source.getSuccess()));
        out.setErrorCode(limit(source.getErrorCode(), 64));
        out.setCreatedAt(source.getCreatedAt() == null ? LocalDateTime.now() : source.getCreatedAt());
        return out;
    }

    private String limit(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
