package com.campus.taskhub.mapper;

import com.campus.taskhub.entity.User;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface UserMapper {

    @Select("SELECT * FROM users WHERE deleted_at IS NULL")
    List<User> findAll();

    @Select("SELECT * FROM users WHERE id = #{id} AND deleted_at IS NULL")
    User findById(Long id);

    @Select("SELECT COUNT(*) FROM users")
    Integer countUsers();

    @Select("SELECT * FROM users WHERE username = #{username} AND deleted_at IS NULL LIMIT 1")
    User findByUsername(String username);

    @Select("SELECT * FROM users WHERE phone = #{phone} AND deleted_at IS NULL LIMIT 1")
    User findByPhone(String phone);

    @Select("SELECT * FROM users WHERE email = #{email} AND deleted_at IS NULL LIMIT 1")
    User findByEmail(String email);

    @Insert("""
            INSERT INTO users (
                username,
                phone,
                email,
                password_hash,
                wechat_openid,
                wechat_unionid,
                avatar_url,
                real_name,
                student_id,
                school,
                college,
                class_name,
                bio,
                balance,
                credit_score,
                auth_status,
                role,
                version,
                created_at,
                updated_at
            ) VALUES (
                #{username},
                #{phone},
                #{email},
                #{passwordHash},
                #{wechatOpenid},
                #{wechatUnionid},
                #{avatarUrl},
                #{realName},
                #{studentId},
                #{school},
                #{college},
                #{className},
                #{bio},
                #{balance},
                #{creditScore},
                #{authStatus},
                'user',
                0,
                NOW(),
                NOW()
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertUser(User user);
}