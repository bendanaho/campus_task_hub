package com.example.keshe_backend.task.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.task.dto.CreateTaskRequest;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.keshe_backend.common.websocket.NotificationWSServer;
import java.math.BigDecimal;
import java.util.List;

import com.example.keshe_backend.common.websocket.NotificationWSServer;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

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
        Long currentUserId = SecurityUtils.getCurrentUserId();
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setCategory(request.getCategory());
        task.setDescription(request.getDescription());
        task.setReward(request.getReward());
        task.setRewardValue(request.getRewardValue() == null ? BigDecimal.ZERO : request.getRewardValue());
        task.setDeadline(request.getDeadline());
        task.setContact(request.getContact());

        task.setType(0);
        task.setStatus("open");
        task.setPaymentStatus(0);

        task.setPublisherId(currentUserId);
        task.setPublisherName(currentUser.getUsername());
        task.setPublisherCredit(currentUser.getCreditScore());
        Task savedTask = taskRepository.save(task);
                try {
                    // 新任务发布：向全站广播
                    String msg = String.format("{\"type\":\"NEW_TASK\",\"postId\":%d,\"title\":\"%s\"}", savedTask.getId(), savedTask.getTitle());
                    NotificationWSServer.broadcast(msg);
                } catch (Exception e) {
                    e.printStackTrace();
                }
                return savedTask;
    }

    @Transactional
    public Task createService(CreateTaskRequest request) {
        Long currentUserId = SecurityUtils.getCurrentUserId();
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setCategory(request.getCategory());
        task.setDescription(request.getDescription());
        task.setReward(request.getReward());
        task.setRewardValue(request.getRewardValue() == null ? BigDecimal.ZERO : request.getRewardValue());
        task.setDeadline(request.getDeadline());
        task.setContact(request.getContact());

        task.setType(1);
        task.setStatus("open");
        task.setPaymentStatus(null);

        task.setPublisherId(currentUserId);
        task.setPublisherName(currentUser.getUsername());
        task.setPublisherCredit(currentUser.getCreditScore());

        Task savedTask = taskRepository.save(task);
        try {
            // 新服务发布：向全站广播
            String msg = String.format("{\"type\":\"NEW_TASK\",\"postId\":%d,\"title\":\"%s\"}", savedTask.getId(), savedTask.getTitle());
            NotificationWSServer.broadcast(msg);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return savedTask;
    }

    @Transactional
    public Task takeTask(Long id) {
        Task task = getTask(id);

        if (!"open".equals(task.getStatus())) {
            throw new BusinessException(ErrorCode.TASK_TAKEN);
        }

        Long currentUserId = SecurityUtils.getCurrentUserId();
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        task.setTakerId(currentUserId);
        task.setTakerName(currentUser.getUsername());
        task.setStatus("open"); // 旧逻辑：接单不关闭帖子，由 Order 模块管理状态

        return taskRepository.save(task);
    }
}
