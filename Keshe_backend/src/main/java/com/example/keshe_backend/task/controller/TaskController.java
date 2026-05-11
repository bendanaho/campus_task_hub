package com.example.keshe_backend.task.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.task.dto.CreateTaskRequest;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping("/tasks")
    public ApiResponse<List<Task>> listTasks() {
        return ApiResponse.success(taskService.listTasks());
    }

    @GetMapping("/tasks/{id}")
    public ApiResponse<Task> getTask(@PathVariable Long id) {
        return ApiResponse.success(taskService.getTask(id));
    }

    @PostMapping("/tasks")
    public ApiResponse<Task> createDemandTask(@Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.success(taskService.createDemandTask(request));
    }

    @PostMapping("/services")
    public ApiResponse<Task> createService(@Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.success(taskService.createService(request));
    }

    @PostMapping("/tasks/{id}/take")
    public ApiResponse<Task> takeTask(
            @PathVariable Long id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        // 最小版本暂不强制校验 Idempotency-Key
        // 后续可在这里调用 IdempotencyService
        return ApiResponse.success(taskService.takeTask(id));
    }
}