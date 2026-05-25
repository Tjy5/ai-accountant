package com.aiaccountant.backend.util;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.exception.ApiException;
import java.net.URI;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AiBaseUrlValidator {
    private final AppProperties properties;

    public AiBaseUrlValidator(AppProperties properties) {
        this.properties = properties;
    }

    public String normalize(String input) {
        String raw = RequestValues.trimToNull(input);
        if (raw == null) throw bad("缺少 API Base URL");
        if (raw.chars().anyMatch(ch -> ch <= 31 || ch == 127) || raw.matches(".*\\s+.*")) throw bad("URL 不允许包含空白字符");
        try {
            URI uri = URI.create(raw);
            if (uri.getUserInfo() != null) throw bad("URL 不允许包含用户名/密码");
            if (!"https".equalsIgnoreCase(uri.getScheme())) throw bad("仅允许 HTTPS");
            if (uri.getQuery() != null || uri.getFragment() != null) throw bad("URL 不允许包含 query/hash");
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT).replaceAll("\\.$", "");
            if (host.isBlank()) throw bad("无效的 hostname");
            if (host.equals("localhost") || host.equals("localhost.localdomain")) throw bad("禁止使用 localhost");
            Set<String> allowlist = Arrays.stream(String.valueOf(properties.getAi().getBaseUrlAllowlist()).split(","))
                .map(String::trim)
                .map(s -> s.toLowerCase(Locale.ROOT))
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
            if (!allowlist.isEmpty() && allowlist.stream().noneMatch(allowed -> host.equals(allowed) || host.endsWith("." + allowed))) {
                throw bad("hostname 不在允许列表中");
            }
            if (isBlockedLiteralHost(host)) throw bad("禁止使用内网/保留地址");
            String path = uri.getPath() == null || "/".equals(uri.getPath()) ? "" : uri.getPath().replaceAll("/+$", "");
            int port = uri.getPort();
            String authority = port > 0 ? host + ":" + port : host;
            return "https://" + authority + path;
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw bad("无效的 URL");
        }
    }

    private boolean isBlockedLiteralHost(String host) {
        if (host.matches("^127\\..*") || host.matches("^10\\..*") || host.matches("^192\\.168\\..*")) return true;
        if (host.matches("^172\\.(1[6-9]|2[0-9]|3[0-1])\\..*")) return true;
        return host.equals("0.0.0.0") || host.equals("::1") || host.equals("[::1]");
    }

    private ApiException bad(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message, "INVALID_AI_BASE_URL");
    }
}
