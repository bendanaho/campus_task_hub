package com.example.keshe_backend.post.dto;

import com.example.keshe_backend.task.entity.Task;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 帖子 DTO（对齐 JS 端 task 对象字段）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostDTO {
    private Long id;
    private String title;
    private String publisherSide;
    private String category;
    private String description;
    private Long publisherId;
    private String publisherName;
    private BigDecimal publisherCredit;
    private String reward;
    private BigDecimal rewardValue;
    private LocalDateTime deadline;
    private LocalDateTime publishTime;
    private String status;
    private String contact;
    private List<String> images;  // 前端期望数组
    private String serviceTime;

    private BigDecimal takerCredit;

    public static PostDTO from(Task task) {
        return PostDTO.builder()
                .id(task.getId())
                .title(task.getTitle())
                .publisherSide(task.getPublisherSide())
                .category(task.getCategory())
                .description(task.getDescription())
                .publisherId(task.getPublisherId())
                .publisherName(task.getPublisherName())
                .publisherCredit(task.getPublisherCredit())
                .reward(task.getReward())
                .rewardValue(task.getRewardValue())
                .deadline(task.getDeadline())
                .publishTime(task.getPublishTime())
                .status(task.getStatus())
                .contact(task.getContact())
                .images(parseImages(task.getImages()))
                .serviceTime(task.getServiceTime())
                .build();
    }

    // 解析 JSON 字符串数组 ["...","..."]。
    // 逐字符扫描、识别引号包裹的元素，正确处理字符串内部的逗号与转义。
    // 旧实现用 split(",") 会把 base64 的 data URL（形如 data:image/png;base64,XXXX，本身带一个逗号）
    // 从中间劈成两半，导致上传图片读回后全部损坏——这是图片无法显示的根因。
    private static List<String> parseImages(String imagesJson) {
        List<String> result = new ArrayList<>();
        if (imagesJson == null || imagesJson.isBlank()) {
            return result;
        }
        boolean inString = false;
        boolean escaped = false;
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < imagesJson.length(); i++) {
            char c = imagesJson.charAt(i);
            if (inString) {
                if (escaped) {
                    switch (c) {
                        case 'n': cur.append('\n'); break;
                        case 'r': cur.append('\r'); break;
                        case 't': cur.append('\t'); break;
                        case 'b': cur.append('\b'); break;
                        case 'f': cur.append('\f'); break;
                        case 'u':
                            if (i + 4 < imagesJson.length()) {
                                try {
                                    cur.append((char) Integer.parseInt(imagesJson.substring(i + 1, i + 5), 16));
                                } catch (NumberFormatException ignore) { /* 非法转义则跳过 */ }
                                i += 4;
                            }
                            break;
                        default: cur.append(c); // 包括 \" \\ \/ 等，取字面量
                    }
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    result.add(cur.toString()); // 一个完整字符串元素结束
                    cur.setLength(0);
                    inString = false;
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                inString = true; // 字符串外遇到引号 → 新元素开始；括号/逗号/空白忽略
            }
        }
        return result;
    }
}
