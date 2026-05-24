package com.campus.taskhub.controller;

import com.campus.taskhub.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @GetMapping("/test")
    public Result<String> test() {
        return Result.success("后端项目启动成功");
    }
}