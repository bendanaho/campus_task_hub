package com.example.keshe_backend.review.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
import com.example.keshe_backend.review.dto.ReviewDTO;
import com.example.keshe_backend.review.dto.SubmitReviewRequest;
import com.example.keshe_backend.review.entity.Review;
import com.example.keshe_backend.review.repository.ReviewRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    /**
     * 提交评价
     */
    @Transactional
    public ReviewDTO submitReview(SubmitReviewRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        // 验证订单存在且当前用户是参与者
        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在"));
        if (!order.getPayerId().equals(userId) && !order.getEarnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不是订单参与者，无法评价");
        }
        if (!"completed".equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_ORDER_STATUS, "订单未完成，无法评价");
        }

        // 防止重复评价
        if (reviewRepository.existsByOrderIdAndFromUserId(request.getOrderId(), userId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "已评价过该订单");
        }

        // 从数据库获取被评价者信息（不信任客户端提交的 toUserName）
        User toUser = userRepository.findById(request.getToUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "被评价用户不存在"));

        // 验证被评价者确实是订单的另一方
        if (!toUser.getId().equals(order.getPayerId()) && !toUser.getId().equals(order.getEarnerId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "被评价者不是订单参与者");
        }

        Review review = new Review();
        review.setOrderId(request.getOrderId());
        review.setTaskId(order.getPostId());
        review.setFromUserId(userId);
        review.setFromUserName(currentUser.getUsername());
        review.setToUserId(toUser.getId());
        review.setToUserName(toUser.getUsername());
        review.setRating(request.getRating());
        review.setContent(request.getContent() != null ? request.getContent() : "");
        review.setAutoReview(false);

        if (request.getImages() != null && !request.getImages().isEmpty()) {
            review.setImages(toJsonArray(request.getImages()));
        }

        review = reviewRepository.save(review);
        return ReviewDTO.from(review);
    }

    /**
     * 获取用户评价列表
     */
    public List<ReviewDTO> getReviews(Long userId) {
        return reviewRepository.findByToUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(ReviewDTO::from)
                .collect(Collectors.toList());
    }

    /**
     * 检查是否已评价
     */
    public boolean hasReviewed(Long orderId) {
        Long userId = SecurityUtils.getCurrentUserId();
        return reviewRepository.existsByOrderIdAndFromUserId(orderId, userId);
    }

    /**
     * 安全 JSON 数组序列化
     */
    private String toJsonArray(List<String> urls) {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (String url : urls) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(esc(url)).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 安全转义 JSON 字符串中的特殊字符（包括控制字符）
     */
    private String esc(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b");  break;
                case '\f': sb.append("\\f");  break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }
}
