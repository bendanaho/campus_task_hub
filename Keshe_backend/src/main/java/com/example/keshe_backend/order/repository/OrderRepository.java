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
