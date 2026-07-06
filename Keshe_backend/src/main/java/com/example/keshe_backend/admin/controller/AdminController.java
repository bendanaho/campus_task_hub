package com.example.keshe_backend.admin.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.order.dto.AdminOrderItemResponse;
import com.example.keshe_backend.order.dto.OrderDTO;
import com.example.keshe_backend.order.dto.ResolveDisputeRequest;
import com.example.keshe_backend.order.service.OrderService;
import com.example.keshe_backend.post.dto.AdminReasonRequest;
import com.example.keshe_backend.post.dto.PostDTO;
import com.example.keshe_backend.post.service.PostService;
import com.example.keshe_backend.report.dto.AdminReportItemResponse;
import com.example.keshe_backend.report.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 管理后台接口。整个 /api/admin/** 命名空间由 SecurityConfig 按 ROLE_ADMIN（user.role=1）鉴权，
 * 普通用户与匿名请求到不了这里。
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final OrderService orderService;
    private final PostService postService;
    private final ReportService reportService;

    /**
     * 待处理争议订单列表
     */
    @GetMapping("/disputes")
    public ApiResponse<List<AdminOrderItemResponse>> listDisputes() {
        return ApiResponse.success(orderService.adminListDisputes());
    }

    /**
     * 全部订单总览
     */
    @GetMapping("/orders")
    public ApiResponse<List<AdminOrderItemResponse>> listOrders() {
        return ApiResponse.success(orderService.adminListOrders());
    }

    /**
     * 裁决争议订单：refund / settle / partial → closed
     */
    @PostMapping("/orders/{id}/resolve")
    public ApiResponse<OrderDTO> resolveDispute(@PathVariable Long id,
                                                @Valid @RequestBody ResolveDisputeRequest request) {
        return ApiResponse.success(orderService.resolveDispute(
                id, request.getDecision(), request.getAmountToEarner(), request.getNote()));
    }

    /**
     * 全部帖子（含已下架/关闭）
     */
    @GetMapping("/posts")
    public ApiResponse<List<PostDTO>> listPosts() {
        return ApiResponse.success(postService.adminListPosts());
    }

    /**
     * 下架帖子（可带原因，随系统通知告知发布者）
     */
    @PostMapping("/posts/{id}/close")
    public ApiResponse<PostDTO> closePost(@PathVariable Long id,
                                          @RequestBody(required = false) AdminReasonRequest request) {
        return ApiResponse.success(postService.adminClosePost(id, request != null ? request.getReason() : null));
    }

    /**
     * 删除帖子（软删，可带原因）
     */
    @PostMapping("/posts/{id}/delete")
    public ApiResponse<PostDTO> deletePost(@PathVariable Long id,
                                           @RequestBody(required = false) AdminReasonRequest request) {
        return ApiResponse.success(postService.adminDeletePost(id, request != null ? request.getReason() : null));
    }

    /**
     * 举报列表（按帖子聚合）
     */
    @GetMapping("/reports")
    public ApiResponse<List<AdminReportItemResponse>> listReports() {
        return ApiResponse.success(reportService.adminListReports());
    }
}
