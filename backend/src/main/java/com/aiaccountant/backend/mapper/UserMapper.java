package com.aiaccountant.backend.mapper;

import com.aiaccountant.backend.entity.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.time.LocalDateTime;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM users WHERE email = #{email} AND deleted_at IS NULL LIMIT 1")
    User findByEmail(@Param("email") String email);

    @Select("SELECT * FROM users WHERE id = #{id} AND deleted_at IS NULL LIMIT 1")
    User findActiveById(@Param("id") Long id);

    @Update("UPDATE users SET name = #{name}, updated_at = #{updatedAt} WHERE id = #{id} AND deleted_at IS NULL")
    int updateName(@Param("id") Long id, @Param("name") String name, @Param("updatedAt") LocalDateTime updatedAt);
}
