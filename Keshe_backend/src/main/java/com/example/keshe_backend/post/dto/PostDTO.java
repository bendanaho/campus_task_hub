package com.example.keshe_backend.post.dto;

import com.example.keshe_backend.task.entity.Task;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
    private String status; // "open" / "closed"
    private String contact;
    private String images; // JSON 数组字符串
    private String serviceTime;

    private BigDecimal takerCredit; // 兼容前端，可为 null

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
                .images(task.getImages())
                .serviceTime(task.getServiceTime())
                .build();
    }
}
