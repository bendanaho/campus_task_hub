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

    /**
     * 该会话仍在托管中的私信转账总额（仅争议单计算）。
     * 争议要分的钱 = order.amount + 它；面板只显示 order.amount 会误导管理员，
     * 让他以为标的只有订单金额那么多。
     */
    private java.math.BigDecimal escrowedTransferTotal;
    /** 争议总额 = order.amount + escrowedTransferTotal */
    private java.math.BigDecimal disputeTotal;
}
