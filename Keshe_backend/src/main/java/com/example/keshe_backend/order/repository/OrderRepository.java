package com.example.keshe_backend.order.repository;

import com.example.keshe_backend.order.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByChatIdOrderByCreatedAtAsc(String chatId);

    /**
     * 批量取多个会话的订单（按创建时间升序），调用方在内存里取每个会话的最后一条，
     * 替代"每个会话查一次 findTopByChatId"的 N+1。
     */
    List<Order> findByChatIdInOrderByCreatedAtAsc(List<String> chatIds);

    Optional<Order> findTopByChatIdOrderByCreatedAtDesc(String chatId);

    List<Order> findByPayerIdOrEarnerIdOrderByCreatedAtDesc(Long payerId, Long earnerId);

    List<Order> findByPayerIdOrderByCreatedAtDesc(Long payerId);

    List<Order> findByEarnerIdOrderByCreatedAtDesc(Long earnerId);

    List<Order> findByPostIdAndStatusIn(Long postId, List<String> statuses);

    List<Order> findByStatusAndAutoConfirmAtBefore(String status, LocalDateTime time);

    List<Order> findByStatusAndReviewDeadlineBefore(String status, LocalDateTime time);

    // 管理员：争议列表（按申诉时间倒序）与全部订单总览
    List<Order> findByStatusOrderByDisputedAtDesc(String status);

    List<Order> findAllByOrderByCreatedAtDesc();
}
