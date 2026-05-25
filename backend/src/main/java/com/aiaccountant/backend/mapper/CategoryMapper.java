package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.Category;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CategoryMapper extends BaseMapper<Category> {
    @Select("SELECT * FROM categories WHERE user_id = #{userId} AND deleted_at IS NULL ORDER BY name")
    List<Category> findActiveByUser(@Param("userId") Long userId);

    @Select("SELECT COUNT(*) FROM categories WHERE user_id = #{userId} AND deleted_at IS NULL")
    long countActiveByUser(@Param("userId") Long userId);

    @Select("SELECT * FROM categories WHERE user_id = #{userId} AND name = #{name} AND deleted_at IS NULL LIMIT 1")
    Category findActiveByName(@Param("userId") Long userId, @Param("name") String name);
}
