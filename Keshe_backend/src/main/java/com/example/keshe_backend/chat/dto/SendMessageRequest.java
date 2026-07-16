package com.example.keshe_backend.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendMessageRequest {
    @NotBlank(message = "消息内容不能为空")
    private String content;

    /** 消息类型：text(默认) / image(content 为图片 URL) */
    private String type;
}
