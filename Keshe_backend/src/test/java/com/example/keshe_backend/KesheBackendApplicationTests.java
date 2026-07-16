package com.example.keshe_backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 上下文加载冒烟测试。
 *
 * 必须用 RANDOM_PORT 起真实容器：WebSocketConfig 的 ServerEndpointExporter 依赖
 * jakarta.websocket.server.ServerContainer，而 @SpringBootTest 默认的 MOCK 环境不提供它，
 * 上下文会直接创建失败。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class KesheBackendApplicationTests {

    @Test
    void contextLoads() {
    }

}
