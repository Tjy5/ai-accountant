package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.Goal;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface GoalMapper extends BaseMapper<Goal> {
    @Select("SELECT * FROM goals WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL LIMIT 1")
    Goal findActiveByIdAndUser(@Param("id") Long id, @Param("userId") Long userId);

    @Select("SELECT * FROM goals WHERE user_id = #{userId} AND deleted_at IS NULL ORDER BY target_date IS NULL ASC, target_date ASC, id ASC")
    List<Goal> findActiveByUser(@Param("userId") Long userId);

    @Select("SELECT * FROM goals WHERE user_id = #{userId} AND title = #{title} AND deleted_at IS NULL LIMIT 1")
    Goal findActiveByTitle(@Param("userId") Long userId, @Param("title") String title);

    @Select("SELECT * FROM goals WHERE user_id = #{userId} AND title = #{title} AND deleted_at IS NULL AND id <> #{id} LIMIT 1")
    Goal findActiveByTitleExcludingId(@Param("userId") Long userId, @Param("title") String title, @Param("id") Long id);

    @Update("UPDATE goals SET deleted_at = #{deletedAt}, updated_at = #{deletedAt}, active_key = CONCAT('DELETED-', id) WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL")
    int softDeleteByIdAndUser(@Param("id") Long id, @Param("userId") Long userId, @Param("deletedAt") LocalDateTime deletedAt);
}
