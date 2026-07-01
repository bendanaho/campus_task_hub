package com.example.keshe_backend.review.dto;

import com.example.keshe_backend.review.entity.Review;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
    private List<String> images;
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
                .images(parseImages(r.getImages()))
                .time(r.getCreatedAt())
                .auto(r.getAutoReview())
                .build();
    }

    private static List<String> parseImages(String imagesJson) {
        if (imagesJson == null || imagesJson.isBlank()) {
            return new ArrayList<>();
        }
        try {
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
