package com.example.keshe_backend.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SubmitAuthRequest {
    @NotBlank(message = "真实姓名不能为空")
    private String realName;

    @NotBlank(message = "学号不能为空")
    private String studentId;

    @NotBlank(message = "学院不能为空")
    private String college;

    private String className;
}
