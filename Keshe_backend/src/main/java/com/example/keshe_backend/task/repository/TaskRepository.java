package com.example.keshe_backend.task.repository;

import com.example.keshe_backend.task.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    List<Task> findByDeletedAtIsNullOrderByPublishTimeDesc();

    List<Task> findByPublisherIdAndDeletedAtIsNullOrderByPublishTimeDesc(Long publisherId);

    List<Task> findByTakerIdAndDeletedAtIsNullOrderByPublishTimeDesc(Long takerId);

    // 防重复提交：同一发布者、相同标题+描述、且在给定时间点之后发布的未删除帖子数量
    long countByPublisherIdAndTitleAndDescriptionAndDeletedAtIsNullAndPublishTimeAfter(
            Long publisherId, String title, String description, LocalDateTime after);
}