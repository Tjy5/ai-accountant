package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.UserSettings;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserSettingsMapper extends BaseMapper<UserSettings> {
    @Select("SELECT * FROM user_settings WHERE user_id = #{userId} AND deleted_at IS NULL LIMIT 1")
    UserSettings findActiveByUserId(@Param("userId") Long userId);
}
