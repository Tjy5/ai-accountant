package com.aiaccountant.backend.util;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.springframework.util.MultiValueMap;

public final class RequestValues {
    private RequestValues() {
    }

    public static String string(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        return v == null ? null : String.valueOf(v);
    }

    public static Object first(Map<String, Object> body, String... keys) {
        if (body == null) return null;
        for (String key : keys) {
            if (body.containsKey(key)) return body.get(key);
        }
        return null;
    }

    public static String firstQuery(MultiValueMap<String, String> query, String... keys) {
        if (query == null) return null;
        for (String key : keys) {
            String value = query.getFirst(key);
            if (value != null) return value;
        }
        return null;
    }

    public static String trimQuery(MultiValueMap<String, String> query, String... keys) {
        if (query == null) return null;
        for (String key : keys) {
            String value = trimToNull(query.getFirst(key));
            if (value != null) return value;
        }
        return null;
    }

    public static boolean hasAny(Map<String, Object> body, String... keys) {
        if (body == null) return false;
        for (String key : keys) {
            if (body.containsKey(key)) return true;
        }
        return false;
    }

    public static String trimToNull(Object value) {
        String s = value == null ? "" : String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    public static BigDecimal decimal(Object value) {
        String raw = trimToNull(value);
        if (raw == null) return null;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static Integer integer(Object value) {
        String raw = trimToNull(value);
        if (raw == null) return null;
        try {
            return Integer.valueOf(raw);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static Long longValue(Object value) {
        String raw = trimToNull(value);
        if (raw == null) return null;
        try {
            return Long.valueOf(raw);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static boolean bool(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.intValue() != 0;
        String raw = value == null ? "" : String.valueOf(value).trim().toLowerCase();
        return raw.equals("1") || raw.equals("true") || raw.equals("yes") || raw.equals("on");
    }

    public static LocalDateTime dateTime(Object value) {
        String raw = trimToNull(value);
        if (raw == null) return null;
        try {
            return OffsetDateTime.parse(raw).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
        }
        try {
            return LocalDateTime.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception ignored) {
        }
        try {
            return LocalDate.parse(raw.substring(0, Math.min(10, raw.length()))).atStartOfDay();
        } catch (Exception ex) {
            return null;
        }
    }
}
