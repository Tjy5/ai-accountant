package com.aiaccountant.backend.service;

import com.aiaccountant.backend.dto.AuthDtos.LoginRequest;
import com.aiaccountant.backend.dto.AuthDtos.RegisterRequest;
import com.aiaccountant.backend.entity.User;
import com.aiaccountant.backend.exception.ApiException;
import com.aiaccountant.backend.mapper.UserMapper;
import com.aiaccountant.backend.security.JwtService;
import com.aiaccountant.backend.util.Rows;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CategoryService categoryService;

    public AuthService(UserMapper userMapper, PasswordEncoder passwordEncoder, JwtService jwtService, CategoryService categoryService) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.categoryService = categoryService;
    }

    @Transactional
    public Map<String, Object> register(RegisterRequest request) {
        String email = request.email() == null ? "" : request.email().trim();
        String password = request.password();
        if (email.isEmpty() || password == null || password.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "账号和密码为必填项");
        if (userMapper.findByEmail(email) != null) throw new ApiException(HttpStatus.CONFLICT, "该账号已被注册");

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setName(request.name() == null || request.name().isBlank() ? null : request.name().trim());
        userMapper.insert(user);
        User created = userMapper.findActiveById(user.getId());
        categoryService.seedDefaultCategoriesForUser(created.getId());
        return authResponse(created);
    }

    public Map<String, Object> login(LoginRequest request) {
        if (request.email() == null || request.email().isBlank() || request.password() == null || request.password().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "账号和密码为必填项");
        }
        User user = userMapper.findByEmail(request.email().trim());
        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "账号或密码错误");
        }
        return authResponse(user);
    }

    public Map<String, Object> me(Long userId) {
        User user = userMapper.findActiveById(userId);
        if (user == null) throw new ApiException(HttpStatus.NOT_FOUND, "用户不存在");
        return Map.of("user", Rows.user(user));
    }

    private Map<String, Object> authResponse(User user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", Rows.user(user));
        out.put("token", jwtService.signToken(user));
        return out;
    }
}
