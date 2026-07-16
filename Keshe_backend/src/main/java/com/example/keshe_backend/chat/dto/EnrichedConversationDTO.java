package com.example.keshe_backend.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 消息中心聚合项：一次请求返回每个会话渲染所需的全部原始数据，
 * 前端据此本地计算角色/状态文案/预览，避免逐会话 N+1 请求(任务详情+订单×2+评价+发送者)。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrichedConversationDTO {

    /** 会话本体(复用现有 ConversationDTO 字段) */
    private ConversationDTO conversation;

    /** 关联任务快照(判定角色/是否发布者用)，无任务时为 null */
    private Long taskPublisherId;
    private String taskPublisherSide;

    /** 任务状态 open/closed；供消息中心区分"还能下单"与"已下架/已结束" */
    private String taskStatus;
    /** 任务是否已被删除（软删或已不存在） */
    private boolean taskDeleted;

    /** 关联订单快照(describeOrderStatus 用)，无订单时为 null */
    private OrderSnapshot order;

    /** 订单完成后我是否已评价(用于"待我评价") */
    private boolean reviewed;

    /** 该会话我的未读消息数 */
    private long unread;

    /** 最后一条消息的发送者用户名(用于预览"对方：xxx")，我方/系统发送时为空 */
    private String lastSenderName;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderSnapshot {
        private Long id;
        private String status;
        private Long payerId;
        private Long earnerId;
        private Boolean payerConfirmed;
        private Boolean earnerConfirmed;
    }
}
