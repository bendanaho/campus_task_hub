package com.example.keshe_backend.common;

import com.example.keshe_backend.BaseIntegrationTest;
import com.example.keshe_backend.order.service.OrderService;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class OptimisticLockConcurrentTest extends BaseIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderService orderService; // 注入需要测试并发性能的业务 Service

    @Test
    public void testWalletConcurrentDeductionWithOptimisticLock() throws InterruptedException {
        // 1. 初始化测试账户，充值 100 元
        User account = new User();
        account.setUsername("concurrentUser");
        account.setBalance(new BigDecimal("100.00"));
        account.setVersion(0); // 乐观锁核心字段
        final User savedAccount = userRepository.save(account);

        int threadCount = 3; // 模拟 3 个请求同时发起对该账户的扣款扣减（例如同时接受 3 笔单子）
        ExecutorService executorService = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        // 2. 多线程并发扣款
        for (int i = 0; i < threadCount; i++) {
            executorService.execute(() -> {
                try {
                    // 调用带有事务和乐观锁控制的扣款业务方法，每次尝试扣除 30 元
                    // 理论上由于版本号 version 的存在，有且仅有 1 个线程能够成功突围更新
                    orderService.freezeBalance(savedAccount.getId(), new BigDecimal("30.00"));
                    successCount.incrementAndGet();
                } catch (ObjectOptimisticLockingFailureException | org.springframework.orm.ObjectOptimisticLockingFailureException e) {
                    failureCount.incrementAndGet(); // 乐观锁成功拦截并发冲突
                } catch (Exception e) {
                    // 其他异常
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(); // 等待所有并发线程执行完毕

        // 3. 断言校验结果
        assertEquals(1, successCount.get(), "高并发乐观锁下，应有且仅有1次扣款成功执行");
        assertEquals(2, failureCount.get(), "其余2次因版本号冲突，应该被成功阻断并抛出乐观锁异常");

        // 校验数据库最终余额应为 100.00 - 30.00 = 70.00 元
        User finalAccount = userRepository.findById(savedAccount.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("70.00").compareTo(finalAccount.getBalance()));
    }
}