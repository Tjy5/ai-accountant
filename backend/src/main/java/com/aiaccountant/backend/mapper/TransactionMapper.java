package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.Transaction;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TransactionMapper extends BaseMapper<Transaction> {
    @Select("SELECT * FROM transactions WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL LIMIT 1")
    Transaction findActiveByIdAndUser(@Param("id") Long id, @Param("userId") Long userId);

    @Select("SELECT * FROM transactions WHERE user_id = #{userId} AND deleted_at IS NULL AND date >= #{start} AND date < #{end} ORDER BY date ASC, id ASC")
    List<Transaction> findByDateRange(@Param("userId") Long userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Select("SELECT category, type, COUNT(*) AS transaction_count, COALESCE(SUM(amount), 0) AS total_amount FROM transactions WHERE user_id = #{userId} AND deleted_at IS NULL GROUP BY category, type")
    List<Map<String, Object>> categoryStatsByUser(@Param("userId") Long userId);

    @Update("UPDATE transactions SET deleted_at = #{deletedAt}, updated_at = #{deletedAt} WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL")
    int softDeleteByIdAndUser(@Param("id") Long id, @Param("userId") Long userId, @Param("deletedAt") LocalDateTime deletedAt);
}
