package com.example.keshe_backend.order;

import com.example.keshe_backend.BaseIntegrationTest;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class OrderAndTransactionTest extends BaseIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    public void testRewardTaskLifecycleAndWalletFlow() throws Exception {
        // 1. 初始化数据库测试数据：创建发布者 A (100元) 和 接单者 B (0元)
        User payer = new User();
        payer.setUsername("payerA");
        payer.setBalance(new BigDecimal("100.00"));
        payer.setIsVerified(true);
        payer = userRepository.save(payer);

        User earner = new User();
        earner.setUsername("earnerB");
        earner.setBalance(new BigDecimal("0.00"));
        earner.setIsVerified(true);
        earner = userRepository.save(earner);

        // 2. 模拟 A 发布了一个 30 元的悬赏需求
        Task task = new Task();
        task.setPublisherId(payer.getId());
        task.setTitle("急求Java环境配置");
        task.setType("PAYER");
        task.setReward(new BigDecimal("30.00"));
        task.setStatus("AVAILABLE");
        task = taskRepository.save(task);

        // 3. 模拟 B 发起接单创建订单，初始状态为 PENDING
        Order order = new Order();
        order.setTaskId(task.getId());
        order.setPayerId(payer.getId());
        order.setEarnerId(earner.getId());
        order.setAmount(task.getReward());
        order.setStatus("PENDING");
        order = orderRepository.save(order);

        // 4. 发起请求：A 接受接单，触发资金冻结
        // 此时通过 MockMvc 模拟 Payer 用户的登录态请求接口
        mockMvc.perform(post("/api/orders/" + order.getId() + "/accept")
                .param("userId", payer.getId().toString()) // 简易身份传参示例，根据具体安全实现调整
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // 验证资金：Payer 的可用余额扣除 30，变为 70
        User updatedPayer = userRepository.findById(payer.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("70.00").compareTo(updatedPayer.getBalance()));

        // 5. 动作：双方确认完成，触发结算转账
        mockMvc.perform(post("/api/orders/" + order.getId() + "/complete")
                .param("userId", payer.getId().toString())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // 验证结算：Earner 账户成功增加 30 元，变为 30.00
        User updatedEarner = userRepository.findById(earner.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("30.00").compareTo(updatedEarner.getBalance()));
        
        // 验证最终订单状态机转为 COMPLETED
        Order finalOrder = orderRepository.findById(order.getId()).orElseThrow();
        assertEquals("COMPLETED", finalOrder.getStatus());
    }

    @Test
    public void testPublishTaskInsufficientBalanceInterception() throws Exception {
        // 无效等价类：测试账户只有10元，却尝试发布50元的高额悬赏帖
        User brokeUser = new User();
        brokeUser.setUsername("brokeUser");
        brokeUser.setBalance(new BigDecimal("10.00"));
        brokeUser.setIsVerified(true);
        brokeUser = userRepository.save(brokeUser);

        String invalidTaskJson = String.format(
                "{\"title\":\"重金求高数答案\",\"type\":\"PAYER\",\"reward\":50.0,\"publisherId\":%d}",
                brokeUser.getId()
        );

        mockMvc.perform(post("/api/tasks/create")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidTaskJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("账户可用余额不足，无法发布此悬赏帖子"));
    }
}