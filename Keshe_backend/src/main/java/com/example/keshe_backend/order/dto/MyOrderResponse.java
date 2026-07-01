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
}
