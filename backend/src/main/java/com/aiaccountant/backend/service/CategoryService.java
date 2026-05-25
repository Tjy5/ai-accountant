package com.aiaccountant.backend.service;

import com.aiaccountant.backend.entity.Category;
import com.aiaccountant.backend.mapper.CategoryMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {
    private final CategoryMapper categoryMapper;

    public CategoryService(CategoryMapper categoryMapper) {
        this.categoryMapper = categoryMapper;
    }

    public List<Category> listInternal(Long userId) {
        seedDefaultCategoriesForUser(userId);
        return categoryMapper.findActiveByUser(userId);
    }

    public String resolveCategoryName(Long userId, String requested, String transactionType) {
        List<Category> categories = listInternal(userId);
        String normalized = requested == null ? null : requested.trim();
        if (normalized != null && !normalized.isEmpty()) {
            for (Category category : categories) {
                if (normalized.equals(category.getName()) && supportsType(category, transactionType)) return category.getName();
            }
        }
        return categories.stream()
            .filter(c -> "其他".equals(c.getName()))
            .filter(c -> supportsType(c, transactionType))
            .findFirst()
            .or(() -> categories.stream().filter(c -> supportsType(c, transactionType)).findFirst())
            .or(() -> categories.stream().findFirst())
            .map(Category::getName)
            .orElse("其他");
    }

    @Transactional
    public void seedDefaultCategoriesForUser(Long userId) {
        if (categoryMapper.countActiveByUser(userId) > 0) return;
        List<DefaultCategory> defaults = List.of(
            new DefaultCategory("餐饮", "expense", "ShoppingOutlined", "#ff4d4f", "日常餐饮消费"),
            new DefaultCategory("交通", "expense", "CarOutlined", "#1890ff", "公共交通、打车等"),
            new DefaultCategory("购物", "expense", "ShoppingOutlined", "#52c41a", "日常用品购买"),
            new DefaultCategory("工资", "income", "DollarOutlined", "#52c41a", "工资收入"),
            new DefaultCategory("奖金", "income", "TrophyOutlined", "#faad14", "奖金、红包等"),
            new DefaultCategory("其他", "both", "AppstoreOutlined", "#8c8c8c", "其他收入或支出")
        );
        for (DefaultCategory d : defaults) {
            if (categoryMapper.findActiveByName(userId, d.name()) != null) continue;
            Category c = new Category();
            c.setUserId(userId);
            c.setName(d.name());
            c.setType(d.type());
            c.setIcon(d.icon());
            c.setColor(d.color());
            c.setDescription(d.description());
            c.setIsDefault(true);
            c.setUsageCount(0);
            categoryMapper.insert(c);
        }
    }

    private boolean supportsType(Category category, String transactionType) {
        return "both".equals(category.getType()) || category.getType() == null || category.getType().equals(transactionType);
    }

    private record DefaultCategory(String name, String type, String icon, String color, String description) {
    }
}
