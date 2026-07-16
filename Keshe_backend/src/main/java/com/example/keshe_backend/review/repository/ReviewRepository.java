package com.example.keshe_backend.review.repository;

import com.example.keshe_backend.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findByToUserIdOrderByCreatedAtDesc(Long toUserId);

    boolean existsByOrderIdAndFromUserId(Long orderId, Long fromUserId);

    /** 批量查"我已评价过的订单 id"，替代逐单 existsByOrderIdAndFromUserId 的 N+1。 */
    @Query("SELECT r.orderId FROM Review r WHERE r.fromUserId = :fromUserId AND r.orderId IN :orderIds")
    List<Long> findReviewedOrderIds(@Param("fromUserId") Long fromUserId, @Param("orderIds") List<Long> orderIds);

    boolean existsByOrderIdAndToUserId(Long orderId, Long toUserId);
}
