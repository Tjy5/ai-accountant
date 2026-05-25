package com.aiaccountant.backend.security;

import com.aiaccountant.backend.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {
    private SecurityUtils() {
    }

    public static Long requireUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Object principal = auth == null ? null : auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal && userPrincipal.getId() != null) {
            return userPrincipal.getId();
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "认证失败");
    }
}
