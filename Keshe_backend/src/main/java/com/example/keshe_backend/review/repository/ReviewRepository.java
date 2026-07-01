package com.example.keshe_backend.review.repository;

import com.example.keshe_backend.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findByToUserIdOrderByCreatedAtDesc(Long toUserId);

    boolean existsByOrderIdAndFromUserId(Long orderId, Long fromUserId);

    boolean existsByOrderIdAndToUserId(Long orderId, Long toUserId);
}
