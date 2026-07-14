package com.example.keshe_backend.task.repository;

import com.example.keshe_backend.task.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    List<Task> findByDeletedAtIsNullOrderByPublishTimeDesc();

    List<Task> findByPublisherIdAndDeletedAtIsNullOrderByPublishTimeDesc(Long publisherId);

    List<Task> findByTakerIdAndDeletedAtIsNullOrderByPublishTimeDesc(Long takerId);
}