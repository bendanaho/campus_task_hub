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

    private static List<String> parseImages(String imagesJson) {
        if (imagesJson == null || imagesJson.isBlank()) {
            return new ArrayList<>();
        }
        try {
            // 简单 JSON 数组解析：["url1","url2"]
            List<String> result = new ArrayList<>();
            String content = imagesJson.trim();
            if (content.startsWith("[")) content = content.substring(1);
            if (content.endsWith("]")) content = content.substring(0, content.length() - 1);
            if (content.isBlank()) return result;
            for (String part : content.split(",")) {
                String url = part.trim();
                if (url.startsWith("\"") && url.endsWith("\"")) {
                    url = url.substring(1, url.length() - 1);
                    url = url.replace("\\\"", "\"");
                }
                if (!url.isBlank()) result.add(url);
            }
            return result;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }
}
