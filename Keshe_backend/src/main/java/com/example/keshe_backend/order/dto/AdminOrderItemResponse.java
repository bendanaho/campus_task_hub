package com.example.keshe_backend.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 管理员端订单条目：{ order, postTitle, payerName, earnerName, disputedByName }
 * （字段名对齐 JS mock 的 _adminOrderItem）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminOrderItemResponse {
    private OrderDTO order;
    private String postTitle;
    private String payerName;
    private String earnerName;
    private String disputedByName;
}
