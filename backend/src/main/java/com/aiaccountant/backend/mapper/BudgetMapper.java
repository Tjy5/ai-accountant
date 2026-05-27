package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.Budget;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BudgetMapper extends BaseMapper<Budget> {
    @Select("SELECT * FROM budgets WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL LIMIT 1")
    Budget findActiveByIdAndUser(@Param("id") Long id, @Param("userId") Long userId);

    @Select("SELECT * FROM budgets WHERE user_id = #{userId} AND period_month = #{periodMonth} AND deleted_at IS NULL ORDER BY category ASC, id ASC")
    List<Budget> findActiveByUserAndMonth(@Param("userId") Long userId, @Param("periodMonth") String periodMonth);

    @Select("SELECT * FROM budgets WHERE user_id = #{userId} AND category = #{category} AND period_month = #{periodMonth} AND deleted_at IS NULL LIMIT 1")
    Budget findActiveByCategoryAndMonth(@Param("userId") Long userId, @Param("category") String category, @Param("periodMonth") String periodMonth);

    @Select("SELECT * FROM budgets WHERE user_id = #{userId} AND category = #{category} AND period_month = #{periodMonth} AND deleted_at IS NULL AND id <> #{id} LIMIT 1")
    Budget findActiveByCategoryAndMonthExcludingId(
        @Param("userId") Long userId,
        @Param("category") String category,
        @Param("periodMonth") String periodMonth,
        @Param("id") Long id
    );

    @Update("UPDATE budgets SET deleted_at = #{deletedAt}, updated_at = #{deletedAt}, active_key = CONCAT('DELETED-', id) WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL")
    int softDeleteByIdAndUser(@Param("id") Long id, @Param("userId") Long userId, @Param("deletedAt") LocalDateTime deletedAt);
}
