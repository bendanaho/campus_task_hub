package com.example.keshe_backend.task.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.task.dto.CreateTaskRequest;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;

    public List<Task> listTasks() {
        return taskRepository.findByDeletedAtIsNullOrderByPublishTimeDesc();
    }

    public Task getTask(Long id) {
        return taskRepository.findById(id)
                .filter(task -> task.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));
    }

    @Transactional
    public Task createDemandTask(CreateTaskRequest request) {
        // 最小版本暂时模拟当前登录用户
        Long currentUserId = 1L;
        String currentUsername = "demo-user";

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setCategory(request.getCategory());
        task.setDescription(request.getDescription());
        task.setReward(request.getReward());
        task.setRewardValue(request.getRewardValue() == null ? BigDecimal.ZERO : request.getRewardValue());
        task.setDeadline(request.getDeadline());
        task.setContact(request.getContact());

        task.setType(0);
        task.setStatus(0);
        task.setPaymentStatus(0);

        task.setPublisherId(currentUserId);
        task.setPublisherName(currentUsername);
        task.setPublisherCredit(new BigDecimal("5.0"));

        return taskRepository.save(task);
    }

    @Transactional
    public Task createService(CreateTaskRequest request) {
        Long currentUserId = 1L;
        String currentUsername = "demo-user";

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setCategory(request.getCategory());
        task.setDescription(request.getDescription());
        task.setReward(request.getReward());
        task.setRewardValue(request.getRewardValue() == null ? BigDecimal.ZERO : request.getRewardValue());
        task.setDeadline(request.getDeadline());
        task.setContact(request.getContact());

        task.setType(1);
        task.setStatus(3);
        task.setPaymentStatus(null);

        task.setPublisherId(currentUserId);
        task.setPublisherName(currentUsername);
        task.setPublisherCredit(new BigDecimal("5.0"));

        return taskRepository.save(task);
    }

    @Transactional
    public Task takeTask(Long id) {
        Task task = getTask(id);

        if (!Integer.valueOf(0).equals(task.getStatus())) {
            throw new BusinessException(ErrorCode.TASK_TAKEN);
        }

        // 最小版本暂时模拟当前接单用户
        task.setTakerId(2L);
        task.setTakerName("demo-taker");
        task.setStatus(1);

        return taskRepository.save(task);
    }
}