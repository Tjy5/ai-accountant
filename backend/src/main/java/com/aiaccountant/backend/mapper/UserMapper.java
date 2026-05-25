package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM users WHERE email = #{email} AND deleted_at IS NULL LIMIT 1")
    User findByEmail(@Param("email") String email);

    @Select("SELECT * FROM users WHERE id = #{id} AND deleted_at IS NULL LIMIT 1")
    User findActiveById(@Param("id") Long id);
}
