package com.aiaccountant.backend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("user_settings")
public class UserSettings {
    @TableId(type = IdType.AUTO)
    private Long id;
    @TableField("user_id")
    private Long userId;
    @TableField("default_currency")
    private String defaultCurrency;
    @TableField("month_start_day")
    private Integer monthStartDay;
    @TableField("receipt_reminders")
    private Boolean receiptReminders;
    @TableField("budget_alerts")
    private Boolean budgetAlerts;
    @TableField("weekly_report")
    private Boolean weeklyReport;
    @TableField("ai_assist_enabled")
    private Boolean aiAssistEnabled;
    @TableField("created_at")
    private LocalDateTime createdAt;
    @TableField("updated_at")
    private LocalDateTime updatedAt;
    @TableField("deleted_at")
    private LocalDateTime deletedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getDefaultCurrency() { return defaultCurrency; }
    public void setDefaultCurrency(String defaultCurrency) { this.defaultCurrency = defaultCurrency; }
    public Integer getMonthStartDay() { return monthStartDay; }
    public void setMonthStartDay(Integer monthStartDay) { this.monthStartDay = monthStartDay; }
    public Boolean getReceiptReminders() { return receiptReminders; }
    public void setReceiptReminders(Boolean receiptReminders) { this.receiptReminders = receiptReminders; }
    public Boolean getBudgetAlerts() { return budgetAlerts; }
    public void setBudgetAlerts(Boolean budgetAlerts) { this.budgetAlerts = budgetAlerts; }
    public Boolean getWeeklyReport() { return weeklyReport; }
    public void setWeeklyReport(Boolean weeklyReport) { this.weeklyReport = weeklyReport; }
    public Boolean getAiAssistEnabled() { return aiAssistEnabled; }
    public void setAiAssistEnabled(Boolean aiAssistEnabled) { this.aiAssistEnabled = aiAssistEnabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
}
