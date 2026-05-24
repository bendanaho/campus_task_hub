package com.campus.taskhub.controller;

import com.campus.taskhub.common.Result;
import com.campus.taskhub.entity.User;
import com.campus.taskhub.mapper.UserMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class UserController {

    private final UserMapper userMapper;

    public UserController(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @GetMapping("/users")
    public Result<List<User>> listUsers() {
        List<User> users = userMapper.findAll();
        return Result.success(users);
    }

    @GetMapping("/users/count")
    public Result<Integer> countUsers() {
        Integer count = userMapper.countUsers();
        return Result.success(count);
    }
}