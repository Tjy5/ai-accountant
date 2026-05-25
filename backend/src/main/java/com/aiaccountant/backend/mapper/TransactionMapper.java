package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.Transaction;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TransactionMapper extends BaseMapper<Transaction> {
    @Select("SELECT * FROM transactions WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL LIMIT 1")
    Transaction findActiveByIdAndUser(@Param("id") Long id, @Param("userId") Long userId);

    @Select("SELECT * FROM transactions WHERE user_id = #{userId} AND deleted_at IS NULL AND date >= #{start} AND date < #{end} ORDER BY date ASC, id ASC")
    List<Transaction> findByDateRange(@Param("userId") Long userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
