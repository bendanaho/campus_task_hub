package com.example.keshe_backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 集成测试基类：使用 RestTemplate 发送真实 HTTP 请求，模拟前端调用方式。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class BaseIntegrationTest {

    @LocalServerPort
    protected int port;

    protected final RestTemplate rest = new RestTemplate();

    protected String currentToken;

    protected String base() { return "http://localhost:" + port + "/api"; }

    private HttpHeaders headers() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (currentToken != null) h.set("Authorization", "Bearer " + currentToken);
        return h;
    }

    // ==================== 用户切换 ====================

    /** 登录为指定用户名（种子用户密码均为 1） */
    protected void loginAs(String username) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        var resp = rest.exchange(base() + "/login", HttpMethod.POST,
                new HttpEntity<>(Map.of("account", username, "password", "1"), h), Map.class);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        currentToken = (String) data.get("token");
    }

    // ==================== HTTP 快捷方法 ====================

    protected ResponseEntity<Map> apiGet(String path) {
        return rest.exchange(base() + path, HttpMethod.GET, new HttpEntity<>(headers()), Map.class);
    }

    protected ResponseEntity<Map> apiPost(String path, Object body) {
        return rest.exchange(base() + path, HttpMethod.POST, new HttpEntity<>(body, headers()), Map.class);
    }

    // ==================== 响应解析 ====================

    protected Map<String, Object> ok(ResponseEntity<Map> resp) {
        Map<String, Object> body = resp.getBody();
        if (body == null) throw new AssertionError("body=null");
        if (!Boolean.TRUE.equals(body.get("success")))
            throw new AssertionError("API失败: " + body.get("message"));
        return body;
    }

    protected Map<String, Object> data(ResponseEntity<Map> resp) {
        return (Map<String, Object>) ok(resp).get("data");
    }

    protected List<Map<String, Object>> dataList(ResponseEntity<Map> resp) {
        return (List<Map<String, Object>>) ok(resp).get("data");
    }

    protected void assertFail(ResponseEntity<Map> resp, String keyword) {
        Map<String, Object> body = resp.getBody();
        if (body != null && Boolean.TRUE.equals(body.get("success")))
            throw new AssertionError("期望失败但 success=true: " + body);
        String msg = body != null ? (String) body.get("message") : "";
        if (!msg.contains(keyword))
            throw new AssertionError("message 缺 '" + keyword + "': " + msg);
    }

    // ==================== 余额 ====================

    protected BigDecimal myBalance() {
        return toBigDecimal(data(apiGet("/user/balance")).get("balance"));
    }

    // ==================== 辅助 ====================

    protected Long longId(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v instanceof Integer) return ((Integer) v).longValue();
        return (Long) v;
    }

    protected String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : null;
    }

    protected Boolean bool(Map<String, Object> m, String key) {
        return (Boolean) m.get(key);
    }

    protected BigDecimal toBigDecimal(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof Integer) return BigDecimal.valueOf((Integer) v);
        if (v instanceof Double) return BigDecimal.valueOf((Double) v);
        return new BigDecimal(v.toString());
    }

    protected HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
}
