package com.example.keshe_backend.common.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@ServerEndpoint("/ws/notification/{userId}") // 前端连接的相对路径地址
public class NotificationWSServer {

    // 线程安全的 Map，用来保存所有当前在线用户的 WebSocket 会话对象
    private static final ConcurrentHashMap<Long, Session> sessionMap = new ConcurrentHashMap<>();

    /**
     * 当某个用户上线，前端成功建立 WebSocket 连接时触发
     */
    @OnOpen
    public void onOpen(Session session, @PathParam("userId") Long userId) {
        sessionMap.put(userId, session);
        log.info("【WebSocket】用户连接成功，用户ID: {}, 当前实时在线人数: {}", userId, sessionMap.size());
    }

    /**
     * 当用户关闭网页、断网或者注销退出时触发
     */
    @OnClose
    public void onClose(@PathParam("userId") Long userId) {
        sessionMap.remove(userId);
        log.info("【WebSocket】用户连接断开，用户ID: {}, 当前实时在线人数: {}", userId, sessionMap.size());
    }

    @OnError
    public void onError(Session session, Throwable error) {
        log.error("【WebSocket】会话发生异常错误: ", error);
    }

    /**
     * 📢 核心功能 1：大厅全局广播（群发消息）
     * 适用场景：有人发新帖、任务状态改变
     */
    public static void broadcast(String message) {
        log.info("【WebSocket】开始群发广播消息: {}", message);
        sessionMap.forEach((userId, session) -> {
            if (session.isOpen()) {
                try {
                    session.getBasicRemote().sendText(message);
                } catch (IOException e) {
                    log.error("【WebSocket】广播给用户 {} 失败", userId, e);
                }
            }
        });
    }

    /**
     * 🎯 核心功能 2：点对点精准单推（给指定某个人发送弹窗通知）
     * 适用场景：通知接单人、通知付款人、实时聊天消息到达提示
     */
    public static void sendToUser(Long userId, String message) {
        Session session = sessionMap.get(userId);
        if (session != null && session.isOpen()) {
            try {
                session.getBasicRemote().sendText(message);
                log.info("【WebSocket】成功给指定用户 {} 点对点推送消息: {}", userId, message);
            } catch (IOException e) {
                log.error("【WebSocket】给用户 {} 点对点发送消息失败", userId, e);
            }
        } else {
            log.info("【WebSocket】用户 {} 当前不在线，跳过实时弹窗推送（后续其自行刷页面即可）", userId);
        }
    }
}