package com.example.keshe_backend.order.dto;

import com.example.keshe_backend.post.dto.PostDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 我的订单响应（对齐 JS getMyOrders 返回格式）
 * { order, post, title, myRole, partnerId, partnerName }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyOrderResponse {
    private OrderDTO order;
    private PostDTO post;
    private String title;
    private String myRole;      // "payer" / "earner"
    private Long partnerId;
    private String partnerName;

    /**
     * 我是否已评价过该订单。后端一次批量算好，前端不必再逐单请求 /reviews/has-reviewed
     * （那是 HTTP 级 N+1：12 个已完成订单就要多发 12 个请求）。
     */
    private boolean reviewed;
}
