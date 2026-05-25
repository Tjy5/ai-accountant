package com.aiaccountant.backend.security;

import com.aiaccountant.backend.config.AppProperties;
import com.aiaccountant.backend.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final AppProperties properties;
    private final SecretKey key;

    public JwtService(AppProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(sha256(properties.getJwt().getSecret()));
    }

    public String signToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(parseDuration(properties.getJwt().getExpiresIn()));
        return Jwts.builder()
            .subject(String.valueOf(user.getId()))
            .claim("email", user.getEmail())
            .claim("name", user.getName())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiry))
            .signWith(key, Jwts.SIG.HS256)
            .compact();
    }

    public UserPrincipal verify(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            Long userId = Long.valueOf(claims.getSubject());
            return new UserPrincipal(userId, claims.get("email", String.class), claims.get("name", String.class));
        } catch (ExpiredJwtException ex) {
            throw ex;
        } catch (JwtException | IllegalArgumentException ex) {
            throw new JwtException("Invalid token", ex);
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static Duration parseDuration(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase();
        if (s.isEmpty()) return Duration.ofDays(30);
        try {
            long value = Long.parseLong(s.replaceAll("[^0-9]", ""));
            if (s.endsWith("ms")) return Duration.ofMillis(value);
            if (s.endsWith("s")) return Duration.ofSeconds(value);
            if (s.endsWith("m")) return Duration.ofMinutes(value);
            if (s.endsWith("h")) return Duration.ofHours(value);
            if (s.endsWith("d")) return Duration.ofDays(value);
            return Duration.ofSeconds(value);
        } catch (Exception ex) {
            return Duration.ofDays(30);
        }
    }
}
