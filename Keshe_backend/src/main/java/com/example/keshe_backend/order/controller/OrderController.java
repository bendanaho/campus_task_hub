package com.example.keshe_backend.order.controller;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.order.dto.CreateOrderRequest;
import com.example.keshe_backend.order.dto.DisputeRequest;
import com.example.keshe_backend.order.dto.MyOrderResponse;
import com.example.keshe_backend.order.dto.OrderDTO;
import com.example.keshe_backend.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * 创建订单（响应帖子）
     */
    @PostMapping
    public ApiResponse<OrderDTO> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        OrderDTO order = orderService.createOrder(request);
        return ApiResponse.success(order);
    }

    /**
     * 接受订单
     */
    @PostMapping("/{id}/accept")
    public ApiResponse<OrderDTO> acceptOrder(@PathVariable Long id) {
        return ApiResponse.success(orderService.acceptOrder(id));
    }

    /**
     * 取消订单
     */
    @PostMapping("/{id}/cancel")
    public ApiResponse<OrderDTO> cancelOrder(@PathVariable Long id) {
        return ApiResponse.success(orderService.cancelOrder(id));
    }

    /**
     * 发起申诉（参与者、仅进行中订单）→ disputed，等待管理员裁决
     */
    @PostMapping("/{id}/dispute")
    public ApiResponse<OrderDTO> disputeOrder(@PathVariable Long id,
                                              @Valid @RequestBody DisputeRequest request) {
        return ApiResponse.success(orderService.disputeOrder(id, request.getReason()));
    }

    /**
     * 确认完成
     */
    @PostMapping("/{id}/confirm")
    public ApiResponse<OrderDTO> confirmOrder(@PathVariable Long id) {
        return ApiResponse.success(orderService.confirmOrder(id));
    }

    /**
     * 按 chatId 查活跃订单
     */
    @GetMapping("/by-chat")
    public ApiResponse<OrderDTO> getActiveOrder(@RequestParam String chatId) {
        return ApiResponse.success(orderService.getActiveOrder(chatId));
    }

    /**
     * 按 chatId 查订单历史
     */
    @GetMapping
    public ApiResponse<List<OrderDTO>> getOrderHistory(@RequestParam String chatId) {
        return ApiResponse.success(orderService.getOrderHistory(chatId));
    }

    /**
     * 我的订单
     */
    @GetMapping("/mine")
    public ApiResponse<List<MyOrderResponse>> getMyOrders(
            @RequestParam(required = false) String role) {
        return ApiResponse.success(orderService.getMyOrders(role));
    }
}
