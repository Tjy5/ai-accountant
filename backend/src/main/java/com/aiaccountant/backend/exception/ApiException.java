package com.aiaccountant.backend.exception;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Object details;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null, null);
    }

    public ApiException(HttpStatus status, String message, String code) {
        this(status, message, code, null);
    }

    public ApiException(HttpStatus status, String message, String code, Object details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public Object getDetails() {
        return details;
    }
}
