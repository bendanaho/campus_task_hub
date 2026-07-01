package com.example.keshe_backend.review.dto;

import com.example.keshe_backend.review.entity.Review;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewDTO {
    private Long id;
    private Long orderId;
    private Long taskId;
    private Long fromUserId;
    private String fromUserName;
    private Long toUserId;
    private String toUserName;
    private int rating;
    private String content;
    private String images;
    private LocalDateTime time;
    private boolean auto;

    public static ReviewDTO from(Review r) {
        return ReviewDTO.builder()
                .id(r.getId())
                .orderId(r.getOrderId())
                .taskId(r.getTaskId())
                .fromUserId(r.getFromUserId())
                .fromUserName(r.getFromUserName())
                .toUserId(r.getToUserId())
                .toUserName(r.getToUserName())
                .rating(r.getRating())
                .content(r.getContent())
                .images(r.getImages())
                .time(r.getCreatedAt())
                .auto(r.getAutoReview())
                .build();
    }
}
